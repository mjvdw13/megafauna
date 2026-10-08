// ============================================================================
// ONLINE SESSION
// A one-off 1v1 with a friend over the internet. The host gets an invite link
// (…?join=<code>); the friend opens it and the two browsers connect directly
// (WebRTC). PeerJS's free public server only introduces them; after that no
// server is involved, so the game can be hosted anywhere static (GitHub Pages).
//
// The host plays P1, the guest P2. Messages (JSON over a reliable, ordered
// data channel):
//   { t: 'lobby', pick, ready, stage }   a player's choices in the online lobby
//   { t: 'start', m, p1, p2, stage }     host → guest: fight number m begins
//   { t: 'in' | 'sum', … }               lockstep inputs and state hashes (lockstep.js)
//   { t: 'ping', at } / { t: 'pong', at } round-trip time; silence means they're gone
// ============================================================================
import { DEFAULT_DELAY, Lockstep } from './lockstep.js';

const PEERJS_SRC = 'vendor/peerjs/peerjs.min.js';
const ID_PREFIX = 'megafauna-';
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const CONNECT_TIMEOUT_MS = 20000;
const PING_EVERY_MS = 1000;
const SILENCE_TIMEOUT_MS = 10000;

let peerLibrary = null;
/** Load PeerJS on first use (it sets window.Peer). */
function loadPeerJs() {
    peerLibrary ??= new Promise((resolve, reject) => {
        if (window.Peer) { resolve(window.Peer); return; }
        const script = document.createElement('script');
        script.src = PEERJS_SRC;
        script.onload = () => resolve(window.Peer);
        script.onerror = () => { peerLibrary = null; reject(new Error('Could not load the networking library')); };
        document.head.appendChild(script);
    });
    return peerLibrary;
}

function randomCode(length = 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

/** The invite code from this page's URL (?join=…), if any. */
export function inviteCodeFromUrl() {
    const code = new URLSearchParams(window.location.search).get('join');
    return code && /^[a-z0-9]{4,32}$/.test(code) ? code : null;
}

/** Remove ?join=… from the address bar, so a refresh doesn't re-join a finished game. */
export function clearInviteFromUrl() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('join')) return;
    url.searchParams.delete('join');
    window.history.replaceState(null, '', url);
}

export class OnlineSession {
    /** @param role  'host' (creates the invite, plays P1) or 'guest' (joins with a code, plays P2) */
    constructor(role, code = null) {
        this.role = role;
        this.localIndex = role === 'host' ? 0 : 1;
        this.code = code;
        this.status = 'connecting';   // connecting → waiting (host only) → connected → closed
        this.error = null;            // why it closed, for the screen
        this.peer = null;
        this.conn = null;
        this.rtt = null;              // round-trip time in ms
        this.lastHeard = 0;
        this.remote = { pick: null, ready: false, stage: null };
        this.matchNumber = 0;
        this.lockstep = null;
        this.pendingStart = null;     // a start the lobby hasn't acted on yet
        const delay = Number(new URLSearchParams(window.location.search).get('delay'));
        this.delay = delay >= 1 && delay <= 15 ? delay : DEFAULT_DELAY;
        this.timers = [];
        this.onUnload = () => this.close();
        window.addEventListener('pagehide', this.onUnload);
    }

    get connected() { return this.status === 'connected'; }
    get closed() { return this.status === 'closed'; }

    get inviteUrl() {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('join', this.code);
        return url.toString();
    }

    async start() {
        try {
            const Peer = await loadPeerJs();
            if (this.closed) return;
            if (this.role === 'host') this.code = randomCode();
            this.peer = new Peer(this.role === 'host' ? ID_PREFIX + this.code : undefined, { debug: 1 });
            // Once connected, the matchmaking server no longer matters: only its errors before then count.
            this.peer.on('error', (err) => { if (!this.connected) this.fail(describeError(err)); });
            this.peer.on('open', () => {
                if (this.role === 'host') {
                    this.status = 'waiting';
                    this.peer.on('connection', (conn) => {
                        if (this.conn) { conn.on('open', () => conn.close()); return; } // one opponent only
                        this.attach(conn);
                    });
                } else {
                    this.attach(this.peer.connect(ID_PREFIX + this.code, { reliable: true, serialization: 'json' }));
                    this.timers.push(setTimeout(() => { if (!this.connected) this.fail("Couldn't reach your friend's game."); }, CONNECT_TIMEOUT_MS));
                }
            });
        } catch (err) {
            this.fail(err.message);
        }
    }

    attach(conn) {
        this.conn = conn;
        conn.on('open', () => {
            if (this.closed) return;
            this.status = 'connected';
            this.lastHeard = performance.now();
            this.timers.push(setInterval(() => this.heartbeat(), PING_EVERY_MS));
        });
        conn.on('data', (msg) => this.receive(msg));
        conn.on('close', () => this.fail('Your opponent left.'));
        conn.on('error', (err) => this.fail(describeError(err)));
    }

    heartbeat() {
        if (performance.now() - this.lastHeard > SILENCE_TIMEOUT_MS) { this.fail('Lost connection to your opponent.'); return; }
        this.send({ t: 'ping', at: performance.now() });
    }

    send(msg) {
        if (this.connected) this.conn.send(msg);
    }

    receive(msg) {
        this.lastHeard = performance.now();
        if (this.lockstep?.receive(msg)) return;
        switch (msg.t) {
            case 'ping': this.send({ t: 'pong', at: msg.at }); break;
            case 'pong': this.rtt = performance.now() - msg.at; break;
            case 'lobby': this.remote = { pick: msg.pick, ready: msg.ready, stage: msg.stage }; break;
            // The lockstep has to exist before the host's first input arrives, which is right behind this.
            case 'start': this.beginMatch(msg); break;
            default:
        }
    }

    /** Share this player's lobby choices. */
    sendLobby(pick, ready, stage = null) { this.send({ t: 'lobby', pick, ready, stage }); }

    /** Host: both are ready, start fight `m`. */
    hostStart({ p1, p2, stage }) {
        const msg = { t: 'start', m: this.matchNumber + 1, p1, p2, stage };
        this.send(msg);
        this.beginMatch(msg);
    }

    beginMatch(msg) {
        this.matchNumber = msg.m;
        this.remote.ready = false;
        this.lockstep = new Lockstep({ localIndex: this.localIndex, delay: this.delay, match: msg.m, send: (m) => this.send(m) });
        this.pendingStart = { p1: msg.p1, p2: msg.p2, stage: msg.stage };
    }

    /** The lobby takes the start it is waiting for (null if none). */
    takeStart() {
        const start = this.pendingStart;
        this.pendingStart = null;
        return start;
    }

    fail(reason) {
        if (this.closed) return;
        this.error = reason;
        this.close();
    }

    close() {
        if (this.closed) return;
        this.status = 'closed';
        for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
        window.removeEventListener('pagehide', this.onUnload);
        try { this.conn?.close(); } catch { /* already gone */ }
        try { this.peer?.destroy(); } catch { /* already gone */ }
    }
}

function describeError(err) {
    switch (err?.type) {
        case 'peer-unavailable': return 'That invite has expired, or the game that made it was closed.';
        case 'network':
        case 'server-error':
        case 'socket-error':
        case 'socket-closed': return "Couldn't reach the matchmaking server. Check your internet connection.";
        case 'browser-incompatible': return "This browser can't play online.";
        case 'unavailable-id': return 'Invite code clash, please try again.';
        default: return err?.message || 'Connection error.';
    }
}

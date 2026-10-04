// ============================================================================
// PIXEL ART GENERATOR
// ============================================================================
class PixelArtGenerator {
    constructor() { this.sprites = new Map(); this.frameCounts = new Map(); }

    render(data, w, h) {
        const c = document.createElement('canvas');
        c.width = w || 128; c.height = h || 128;
        const ctx = c.getContext('2d');
        for (const d of data) { ctx.fillStyle = d[4]; ctx.fillRect(d[0]*4, d[1]*4, d[2]*4, d[3]*4); }
        return c;
    }

    cache(name, state, frame, canvas) {
        this.sprites.set(`${name}_${state}_${frame}`, canvas);
        const k = `${name}_${state}`;
        this.frameCounts.set(k, Math.max(this.frameCounts.get(k)||0, frame+1));
    }

    getSprite(name, state, frame) { return this.sprites.get(`${name}_${state}_${frame}`); }
    getFrameCount(name, state) { return this.frameCounts.get(`${name}_${state}`) || 1; }
    getBackground() { return this.sprites.get('background'); }
    sy(data, dy) { return data.map(d => [d[0], d[1]+dy, d[2], d[3], d[4]]); }
    sx(data, dx) { return data.map(d => [d[0]+dx, d[1], d[2], d[3], d[4]]); }

    generateAll() { this.genRiley(); this.genQuackers(); this.genBackground(); }

    genRiley() {
        const R='#c0392b',S='#a93226',B='#d4a574',E='#8b2020',W='#fff',K='#000';
        const ears=[[9,0,3,4,E],[18,0,3,4,E],[10,1,1,1,R],[19,1,1,1,R]];
        const head=[[9,3,14,8,R],[17,5,2,2,W],[18,5,1,1,K],[21,6,5,3,S],[25,6,1,1,K],[21,9,2,1,E]];
        const body=[[8,11,14,10,R],[8,11,14,2,S],[10,14,10,5,B]];
        const tail=[[5,13,3,2,R],[3,11,3,3,R],[2,10,1,1,S]];
        const legs=[[9,21,3,6,R],[13,21,3,6,S],[17,21,3,6,R],[21,21,3,6,S]];
        const paws=[[8,27,4,2,S],[12,27,4,2,S],[16,27,4,2,S],[20,27,4,2,S]];
        const base=[...ears,...head,...body,...tail,...legs,...paws];

        // IDLE 2f
        this.cache('riley','idle',0,this.render(base));
        this.cache('riley','idle',1,this.render(this.sy(base,1)));

        // WALKING 4f
        const wl=[
            [[9,21,3,6,R],[13,22,3,6,S],[17,22,3,6,R],[21,20,3,7,S],[8,27,4,2,S],[12,28,4,2,S],[16,28,4,2,S],[20,27,4,2,S]],
            [[9,20,3,7,R],[13,23,3,5,S],[17,23,3,5,R],[21,20,3,7,S],[8,27,4,2,S],[12,28,4,2,S],[16,28,4,2,S],[20,27,4,2,S]],
            [[9,22,3,6,R],[13,21,3,6,S],[17,21,3,6,R],[21,22,3,6,S],[8,28,4,2,S],[12,27,4,2,S],[16,27,4,2,S],[20,28,4,2,S]],
            [[9,23,3,5,R],[13,20,3,7,S],[17,20,3,7,R],[21,23,3,5,S],[8,28,4,2,S],[12,27,4,2,S],[16,27,4,2,S],[20,28,4,2,S]]
        ];
        for(let f=0;f<4;f++){const b=f%2;this.cache('riley','walking',f,this.render([...this.sy([...ears,...head,...body,...tail],b),...wl[f]]));}

        // CROUCHING 1f
        this.cache('riley','crouching',0,this.render([
            [7,11,4,3,E],[20,11,3,3,E],[10,10,12,7,R],[18,12,2,2,W],[19,12,1,1,K],[20,14,5,3,S],[24,14,1,1,K],
            [6,16,18,8,R],[6,16,18,2,S],[8,19,14,4,B],[3,17,4,2,R],
            [8,24,4,4,R],[14,24,4,4,S],[20,24,4,4,R],[7,27,5,2,S],[13,27,5,2,S],[19,27,5,2,S]
        ]));

        // JUMPING 1f
        this.cache('riley','jumping',0,this.render([
            [10,-2,3,5,E],[19,-2,3,5,E],[11,-1,1,1,R],[20,-1,1,1,R],
            [10,2,12,7,R],[18,4,2,2,W],[19,4,1,1,K],[20,5,5,3,S],[24,5,1,1,K],
            [9,9,14,10,R],[9,9,14,2,S],[11,12,10,5,B],[7,17,3,3,R],[6,19,1,1,S],
            [10,19,4,3,R],[17,19,4,3,R],[10,22,5,2,S],[17,22,5,2,S]
        ]));

        // FALLING 1f
        this.cache('riley','falling',0,this.render([
            [9,3,3,3,E],[19,3,3,3,E],[10,5,12,7,R],[18,7,2,2,W],[19,7,1,1,K],[21,8,5,3,S],[25,9,1,1,K],
            [8,12,14,8,R],[8,12,14,2,S],[10,15,10,4,B],[5,12,3,2,R],[4,10,1,1,S],
            [6,20,3,6,R],[12,19,3,7,R],[18,19,3,7,R],[24,20,3,6,R],
            [5,25,4,2,S],[11,25,4,2,S],[17,25,4,2,S],[23,25,4,2,S]
        ]));

        // ATTACKING 2f
        this.cache('riley','attacking',0,this.render([
            ...ears,...head,[21,8,4,2,W],...body,...tail,
            [9,21,3,6,R],[13,21,3,6,S],[17,21,3,6,R],[22,17,3,5,R],
            [8,27,4,2,S],[12,27,4,2,S],[16,27,4,2,S]
        ]));
        this.cache('riley','attacking',1,this.render([
            ...this.sx(ears,1),...this.sx(head,1),[22,8,4,2,W],...body,...tail,
            [9,21,3,6,R],[13,21,3,6,S],[17,21,3,6,R],[24,11,4,4,R],
            [8,27,4,2,S],[12,27,4,2,S],[16,27,4,2,S],
            [28,10,3,1,W],[29,12,2,1,W],[28,14,3,1,W]
        ]));

        // BLOCKING 1f
        this.cache('riley','blocking',0,this.render([
            [9,3,3,3,E],[18,3,3,3,E],[9,5,12,8,R],[17,7,2,2,W],[18,7,1,1,K],
            [20,5,4,6,R],[24,6,3,5,S],[8,13,14,9,R],[8,13,14,2,S],[10,16,10,4,B],
            [5,15,3,2,R],[3,13,3,3,R],
            [7,22,3,7,R],[12,22,3,7,R],[18,22,3,7,R],[23,22,3,7,R],
            [6,28,4,2,S],[11,28,4,2,S],[17,28,4,2,S],[22,28,4,2,S]
        ]));

        // HITSTUN 2f
        for(let f=0;f<2;f++){const j=f===0?-2:2;this.cache('riley','hitstun',f,this.render([
            ...this.sx(ears,j),[9+j,3,14,8,R],[21+j,6,5,3,S],[25+j,6,1,1,K],
            [16+j,5,1,1,W],[18+j,5,1,1,W],[17+j,6,1,1,W],[16+j,7,1,1,W],[18+j,7,1,1,W],
            ...body,...tail,...legs,...paws,
            [f===0?28:1,6,2,1,'#f39c12'],[f===0?27:2,9,3,1,'#f39c12'],[f===0?28:1,12,2,1,'#f39c12']
        ]));}

        // KNOCKDOWN 1f
        this.cache('riley','knockdown',0,this.render([
            [4,20,18,6,R],[6,22,14,3,B],[22,18,8,6,R],[28,20,3,2,S],[30,20,1,1,K],
            [23,17,3,2,E],[27,17,3,2,E],
            [26,19,1,1,W],[27,19,1,1,K],[27,20,1,1,W],[26,20,1,1,K],
            [29,23,2,2,'#e74c3c'],[6,16,3,4,R],[11,15,3,5,R],[16,16,3,4,R],[2,21,3,2,R]
        ]));

        // GETUP 2f
        this.cache('riley','getup',0,this.render([
            [10,8,3,3,E],[19,8,3,3,E],[10,10,12,7,R],[18,12,2,2,W],[19,12,1,1,K],[20,13,4,3,S],[23,13,1,1,K],
            [8,16,14,8,R],[8,16,14,2,S],[10,19,10,4,B],[5,17,3,2,R],
            [20,20,3,6,R],[24,22,3,4,R],[8,24,3,4,R],[13,24,3,4,R],
            [7,27,4,2,S],[12,27,4,2,S],[19,25,4,2,S],[23,25,4,2,S]
        ]));
        this.cache('riley','getup',1,this.render([
            ...this.sy(ears,2),...this.sy(head,2),...this.sy(body,2),[5,15,3,2,R],[3,13,3,3,R],
            ...this.sy(legs,2),...this.sy(paws,1)
        ]));

        // VICTORY 2f
        for(let f=0;f<2;f++){this.cache('riley','victory',f,this.render([
            ...ears,[9,3,14,8,R],[17,5,1,1,K],[18,4,1,1,K],[19,5,1,1,K],[21,6,5,3,S],[25,6,1,1,K],
            ...body,[5,13,3,2,R],[3,f===0?12:10,3,3,R],[2,f===0?11:9,1,1,S],
            [22,f===0?4:2,3,f===0?8:9,R],[22,f===0?2:0,4,3,S],
            [27,1+f,1,1,'#f1c40f'],[26,2,1,1,W],[28,2,1,1,W],[27,3-f,1,1,'#f1c40f'],
            [9,21,3,7,R],[13,21,3,7,R],[18,21,3,7,R],[8,27,4,2,S],[12,27,4,2,S],[17,27,4,2,S]
        ]));}

        // DEFEAT 1f
        this.cache('riley','defeat',0,this.render([
            [10,9,3,2,E],[19,9,3,2,E],[10,10,12,7,R],[17,12,2,2,W],[18,12,1,1,K],[20,14,4,3,S],[23,14,1,1,K],
            [18,14,1,1,'#3498db'],[18,15,1,1,'#5dade2'],
            [8,16,14,10,R],[8,16,14,2,S],[10,19,10,5,B],[4,20,4,2,R],
            [8,26,5,3,R],[14,26,5,3,S],[19,26,5,3,R],[7,28,6,2,S],[13,28,6,2,S],[18,28,6,2,S]
        ]));
    }

    genQuackers() {
        const Y='#f1c40f',Ys='#d4ac0d',O='#e67e22',Yb='#fce4a8',W='#fff',K='#000',Od='#d35400';
        const tuft=[[13,0,2,3,Ys],[14,-1,1,1,Ys]];
        const head=[[10,1,10,2,Y],[9,3,12,5,Y],[10,8,10,1,Y],[17,4,2,2,W],[18,4,1,1,K],[19,5,5,2,O],[19,7,4,1,Od]];
        const body=[[10,10,10,2,Y],[9,12,12,8,Y],[10,20,10,2,Y],[9,12,12,1,Ys],[11,14,8,5,Yb]];
        const wings=[[6,14,3,6,Ys],[21,14,3,6,Ys]];
        const feet=[[10,22,4,2,O],[16,22,4,2,O],[9,23,1,1,O],[14,23,1,1,O],[15,23,1,1,O],[20,23,1,1,O]];
        const base=[...tuft,...head,...body,...wings,...feet];

        // IDLE 2f
        this.cache('quackers','idle',0,this.render(base));
        this.cache('quackers','idle',1,this.render([
            ...this.sy(tuft,1),...this.sy(head,1),...this.sy(body,1),
            [6,12,3,6,Ys],[21,12,3,6,Ys],...this.sy(feet,1)
        ]));

        // WALKING 4f
        for(let f=0;f<4;f++){const t=[0,1,0,-1][f],b=f%2;this.cache('quackers','walking',f,this.render([
            ...this.sx(this.sy(tuft,b),t),...this.sx(this.sy(head,b),t),
            ...this.sx(this.sy(body,b),t),...this.sx(this.sy(wings,b),t),
            [10+t+[0,2,0,-2][f],22+b,4,2,O],[16+t+[0,-2,0,2][f],22+b,4,2,O]
        ]));}

        // CROUCHING 1f
        this.cache('quackers','crouching',0,this.render([
            [13,10,2,3,Ys],[9,12,12,6,Y],[17,14,2,2,W],[18,14,1,1,K],[19,15,4,2,O],
            [6,17,18,8,Y],[6,17,18,1,Ys],[8,19,14,4,Yb],
            [3,19,4,4,Ys],[23,19,4,4,Ys],[10,25,4,2,O],[16,25,4,2,O]
        ]));

        // JUMPING 1f
        this.cache('quackers','jumping',0,this.render([
            ...tuft,...head,[17,3,2,2,W],[18,2,1,1,K],...body,
            [2,12,6,3,Ys],[0,11,3,2,Y],[22,12,6,3,Ys],[27,11,3,2,Y],
            [11,22,3,2,O],[16,22,3,2,O]
        ]));

        // FALLING 1f
        this.cache('quackers','falling',0,this.render([
            ...tuft,[9,3,12,5,Y],[10,1,10,2,Y],[10,8,10,1,Y],
            [17,4,2,2,W],[18,5,1,1,K],[16,3,1,1,K],[19,5,5,2,O],[19,7,4,1,Od],
            ...body,[3,8,5,3,Ys],[1,7,3,2,Y],[22,8,5,3,Ys],[26,7,3,2,Y],
            [10,22,3,4,O],[17,23,3,4,O],[9,25,1,1,O],[20,26,1,1,O]
        ]));

        // ATTACKING 2f
        this.cache('quackers','attacking',0,this.render([
            ...tuft,[10,1,10,2,Y],[9,3,12,5,Y],[10,8,10,1,Y],[17,4,2,2,W],[18,4,1,1,K],
            [19,4,6,2,O],[19,7,6,2,Od],...body,...wings,...feet
        ]));
        this.cache('quackers','attacking',1,this.render([
            ...this.sx(tuft,-1),[9,1,10,2,Y],[8,3,12,5,Y],[9,8,10,1,Y],
            [16,4,2,2,W],[17,4,1,1,K],[18,5,5,2,O],[18,7,4,1,Od],
            ...this.sx(body,-1),[23,12,5,4,Ys],[27,13,3,2,Y],[3,14,4,4,Ys],...feet,
            [30,11,1,1,'#f1c40f'],[29,10,1,1,W],[31,12,1,1,W],[30,13,1,1,'#f1c40f']
        ]));

        // BLOCKING 1f
        this.cache('quackers','blocking',0,this.render([
            ...this.sy(tuft,2),[9,5,12,6,Y],[10,3,10,2,Y],[18,8,1,1,W],[18,9,1,1,K],
            ...this.sy(body,1),[19,6,5,12,Ys],[23,8,3,8,Y],...this.sy(feet,1)
        ]));

        // HITSTUN 2f
        for(let f=0;f<2;f++){const j=f===0?-2:2;this.cache('quackers','hitstun',f,this.render([
            ...this.sx(tuft,j),...this.sx(head,j),
            [16+j,4,1,1,W],[17+j,4,1,1,K],[17+j,5,1,1,W],[16+j,5,1,1,K],
            ...body,...this.sx(wings,j),...feet,
            [5+f*3,6,1,1,Y],[26-f*2,4,1,1,Yb],[3+f,14,1,1,Ys],
            [f===0?28:1,8,2,1,'#f39c12'],[f===0?27:2,11,3,1,'#f39c12']
        ]));}

        // KNOCKDOWN 1f
        this.cache('quackers','knockdown',0,this.render([
            [6,20,16,6,Y],[8,21,12,4,Yb],[22,18,8,6,Y],[28,20,3,2,O],[25,17,1,1,Ys],
            [25,19,1,1,K],[27,19,1,1,K],[26,20,1,1,K],[25,21,1,1,K],[27,21,1,1,K],
            [29,23,2,2,'#e74c3c'],[8,16,3,4,O],[14,15,3,5,O]
        ]));

        // GETUP 2f
        this.cache('quackers','getup',0,this.render([
            [14,8,2,3,Ys],[10,10,12,7,Y],[18,13,2,2,W],[19,13,1,1,K],[20,14,4,2,O],
            [7,16,16,8,Y],[7,16,16,1,Ys],[9,18,12,4,Yb],
            [3,18,4,3,Ys],[23,17,4,3,Ys],[10,24,4,2,O],[16,24,4,2,O]
        ]));
        this.cache('quackers','getup',1,this.render([
            ...this.sy(tuft,2),...this.sy(head,2),...this.sy(body,2),...this.sy(wings,2),...this.sy(feet,2)
        ]));

        // VICTORY 2f
        for(let f=0;f<2;f++){this.cache('quackers','victory',f,this.render([
            ...tuft,[10,1,10,2,Y],[9,3,12,5,Y],[10,8,10,1,Y],
            [17,4,1,1,K],[18,3,1,1,K],[19,4,1,1,K],[19,5,5,2,O],[19,7,4,1,Od],
            ...body,[2,12+f,6,3,Ys],[0,11+f,3,2,Y],[22,12+f,6,3,Ys],[27,11+f,3,2,Y],
            [13,22,4,2,O],[12,23,1,1,O],[17,23,1,1,O],[20,20-f,3,3,O],
            [24,2+f,1,1,W],[25,1,1,1,W],[26,3+f,1,1,W],[24,3+f,1,1,K]
        ]));}

        // DEFEAT 1f
        this.cache('quackers','defeat',0,this.render([
            [14,10,1,1,Ys],[15,9,1,1,Ys],[16,10,1,1,Ys],
            [10,11,12,6,Y],[18,13,2,2,W],[19,13,1,1,K],[20,14,4,2,O],
            [19,15,1,1,'#3498db'],[19,16,1,1,'#5dade2'],
            [8,16,14,10,Y],[8,16,14,1,Ys],[10,19,10,5,Yb],
            [4,19,4,5,Ys],[22,19,4,5,Ys],[10,26,4,2,O],[16,26,4,2,O]
        ]));
    }

    genBackground() {
        const c = document.createElement('canvas'); c.width=1280; c.height=720;
        const ctx = c.getContext('2d');
        const p=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(x*4,y*4,w*4,h*4);};
        // Sky gradient
        ['#4a93c9','#5ba3d9','#6bb3e3','#7bbde7','#87CEEB','#93d4ef','#a0daf3','#b0e4f8'].forEach((col,i)=>p(0,i*14,320,14,col));
        // Sun
        p(270,20,10,10,'#f9e547');p(271,21,8,8,'#fef08a');
        p(267,24,3,2,'#f9e547');p(280,24,3,2,'#f9e547');p(274,17,2,3,'#f9e547');p(274,30,2,3,'#f9e547');
        // Clouds
        const cl=(cx,cy,s)=>{p(cx,cy+1,s*3,s,'#fff');p(cx+s,cy,s,s+2,'#fff');p(cx+1,cy+1,s*3-2,s-1,'#ecf0f1');};
        cl(40,25,3);cl(140,15,4);cl(230,35,2);
        // Mountains
        const mt=(cx,base,w,h,col)=>{for(let r=0;r<h;r++){const t=r/h;p(Math.floor(cx+w/2-t*w/2),base+r,Math.ceil(t*w)||1,1,col);}};
        mt(30,80,50,35,'#6b7d8e');mt(120,75,65,40,'#5a6d7e');mt(230,82,55,32,'#7b8d9e');
        p(52,80,6,3,'#fff');p(148,75,8,4,'#fff');p(254,82,6,3,'#fff');
        // Grass
        p(0,88,320,25,'#6B8E23');p(0,88,320,3,'#7BA828');
        for(let gx=0;gx<320;gx+=3){if(gx%6===0)p(gx,87,1,1,'#7BA828');if(gx%9===0){p(gx+1,86,1,1,'#8BC34A');p(gx+1,87,1,1,'#7BA828');}}
        p(45,87,1,1,'#e74c3c');p(100,86,1,1,'#f1c40f');p(180,87,1,1,'#e74c3c');p(250,86,1,1,'#9b59b6');p(290,87,1,1,'#f1c40f');
        p(20,95,8,3,'#5a7d18');p(90,100,10,2,'#5a7d18');p(200,96,6,3,'#5a7d18');
        // Dirt ground
        p(0,113,320,67,'#8B4513');p(0,113,320,4,'#654321');
        for(let dy=118;dy<175;dy+=7){p(10+(dy*3)%40,dy,20+(dy*7)%30,1,'#7a3a0f');p(100+(dy*5)%50,dy,15+(dy*3)%20,1,'#7a3a0f');p(220+(dy*2)%40,dy,25+(dy*4)%15,1,'#7a3a0f');}
        p(30,130,3,2,'#999');p(150,140,4,2,'#888');p(260,125,3,2,'#999');
        p(55,115,8,1,'#5a3010');p(190,114,6,1,'#5a3010');
        // Stage boundaries
        ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(0,0,50,720);ctx.fillRect(1230,0,50,720);
        this.sprites.set('background',c);
    }
}

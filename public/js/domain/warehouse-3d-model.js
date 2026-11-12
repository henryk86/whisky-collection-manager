import { shelfLevels } from './warehouse-compartments.js';

/** Physical furniture geometry for the Three.js scene; measurements are metres.
 * X runs west-east, Y is height above floor, Z runs north-south.
 * No painter ordering, SVG masks or projection calculations belong here.
 */
export const WAREHOUSE_CAMERAS = Object.freeze([
    ['nw', 'Nordwest'], ['ne', 'Nordost'], ['se', 'Südost'], ['sw', 'Südwest'],
]);
const rotate = item => ((Number(item.rotation) || 0) % 360 + 360) % 360;
export const furnitureFootprint = item => rotate(item) % 180 === 0
    ? {width: Number(item.width), depth: Number(item.depth)}
    : {width: Number(item.depth), depth: Number(item.width)};
export function cameraForFurniture(item, previous = 'nw') {
    const faces = {
        0: ['sw', 'se'], 90: ['nw', 'sw'],
        180: ['nw', 'ne'], 270: ['ne', 'se'],
    }[rotate(item)] || WAREHOUSE_CAMERAS.map(([id]) => id);
    if (faces.includes(previous)) return previous;
    return faces[0];
}
export const cameraDirection = corner => ({
    nw: [-1, -1], ne: [1, -1], se: [1, 1], sw: [-1, 1],
})[corner] || [-1, -1];
const limit = (x, min, max) => Math.max(min, Math.min(max, x));

/** World-space direction of the furniture's physical front (0=south, 90=west).
 * The footprint is axis-aligned, but front elements must rotate with it.
 */
export function furnitureFront(item) {
    const angle = rotate(item) * Math.PI / 180;
    const nx = -Math.sin(angle), nz = Math.cos(angle);
    return {normal:[Math.round(nx),Math.round(nz)], tangent:[Math.round(Math.cos(angle)),Math.round(Math.sin(angle))]};
}


/** Convert known warehouse furniture types into actual solid physical pieces.
 * All primitives occupy physical space: WebGL's depth buffer handles occlusion.
 */
export function warehouse3DGeometry(room, warehouse, isolatedId = null) {
    const objects = [];
    const assignments = warehouse.assignments || {};
    const bottles = new Set((warehouse.bottles || []).map(b => b.id));
    const count = new Map();
    for (const [bottleId, shelfId] of Object.entries(assignments)) if (bottles.has(bottleId)) {
        count.set(shelfId, (count.get(shelfId) || 0) + 1);
    }
    for (const item of room.furniture || []) {
        if (isolatedId && isolatedId !== item.id) continue;
        const {width, depth} = furnitureFootprint(item);
        const x = Number(item.x) + width/2;
        const z = Number(item.y) + depth/2;
        const base = Number(item.elevation) || 0;
        const height = Number(item.itemHeight) || (item.type === 'haengeregal' ? 0.4 : 1.8);
        const shelves = item.shelves || [];
        const bayCount = Math.max(1, shelves.length);
        const levels = shelfLevels(item);
        const customised = (item.doorRanges || []).length > 0 || item.doorLeaves != null || item.glassFrame != null || shelves.some(shelf => shelf.front != null || shelf.heightCm != null || shelf.doorLeaves != null || shelf.glassFrame != null);
        const t = limit(Math.min(width, depth, height) * 0.045, 0.012, 0.035);
        const upright = limit(Math.min(width, depth) * 0.065, 0.018, 0.047);
        const result = {id:item.id, name:item.name, type:item.type, parts:[], shelfCount:shelves.length};
        const box = (px, py, pz, w, h, d, style, role = '') => {
            result.parts.push({center:[px,py,pz],size:[w,h,d],style,role});
        };
        const board = level => box(x,level,z,width,t,depth,'board','shelf-board');
        const frame = () => {
            for (const sx of [-1,1]) for (const sz of [-1,1]) {
                box(x+sx*(width-upright)/2, base+height/2, z+sz*(depth-upright)/2,
                    upright,height,upright,'frame','post');
            }
        };
        const top = base + height;
        const {normal:[frontX,frontZ], tangent:[sideX,sideZ]} = furnitureFront(item);
        const frontPlane = (offset,py,faceWidth,faceHeight,thickness,style,role) => {
            const out = Number(item.width);
            const d = Number(item.depth);
            const distance = d/2 + thickness/2;
            box(x+frontX*distance+sideX*offset,py,z+frontZ*distance+sideZ*offset,
                Math.abs(frontX) ? thickness : faceWidth,faceHeight,
                Math.abs(frontZ) ? thickness : faceWidth,style,role);
        };
        // A mixed unit uses one physical compartment per stored shelf.
        // They are ordered BOTTOM to TOP, and may independently have open,
        // wooden-door, glass-door or drawer fronts. Never paint a solid cabinet
        // body behind an explicitly open compartment.
        const individual = customised && shelves.length > 0;
        if (individual) {
            if (item.type !== 'haengeregal') frame();
            const boardLevels = [base, ...levels.map(level => level.top)];
            for (const level of boardLevels) board(Math.min(top - t/2, level + t/2));
            const makeFront = (front, bottom, upper, leavesOverride, frameOverride) => {
                const span = upper-bottom;
                const panelH = Math.max(0.015, span - t*1.3);
                const centreY = (bottom+upper)/2;
                if (front === 'door' || front === 'glass') {
                    const leaves = leavesOverride ?? item.doorLeaves ?? (front === 'glass' ? 1 : 2);
                    const leafWidth = Number(item.width) / leaves;
                    const glass = front === 'glass';
                    const hasFrame = glass && (frameOverride ?? item.glassFrame) === true;
                    for (let leaf = 0; leaf < leaves; leaf++) {
                        const offset = (leaf - (leaves-1)/2) * leafWidth;
                        frontPlane(offset, centreY, Math.max(0.015,leafWidth-t*0.7),panelH,
                            glass ? t*0.6 : t*0.8,glass ? 'glass':'door',glass ? 'glass-front':'door');
                        if (hasFrame) {
                            const fw = Math.max(t*0.35,0.008);
                            const edge = (leafWidth - fw)/2;
                            const topEdge = (panelH-fw)/2;
                            for (const sign of [-1,1]) {
                                frontPlane(offset + sign*edge,centreY,fw,panelH,t,'frame','glass-frame');
                                frontPlane(offset,centreY+sign*topEdge,Math.max(0.015,leafWidth-fw),fw,t,'frame','glass-frame');
                            }
                        }
                    }
                } else if (front === 'drawer') {
                    frontPlane(0,centreY,Math.max(0.03,Number(item.width)-t*2),panelH,t,'drawer','drawer');
                }
            };
            for (const range of item.doorRanges || []) {
                const first=levels[range.from-1], last=levels[range.to-1];
                if (first && last) makeFront(range.front,first.bottom,last.top,range.doorLeaves,range.glassFrame);
            }
            for (const level of levels) {
                const range = (item.doorRanges || []).find(r=>level.index+1>=r.from && level.index+1<=r.to);
                const front = range?.front || level.front;
                const span = level.height;
                if (!range) makeFront(front,level.bottom,level.top,level.shelf.doorLeaves,level.shelf.glassFrame);
                const amount=Math.min(4,count.get(level.shelf.id)||0);
                if (front === 'open' || front === 'glass') {
                    const bottleHeight=limit(span*0.55,0.035,0.22);
                    for(let j=0;j<amount;j++){
                        const along=((j+1)/(amount+1)-0.5)*Number(item.width)*0.72;
                        box(x+sideX*along,level.bottom+t+bottleHeight/2,z+sideZ*along,
                            Math.min(0.09,width/10),bottleHeight,Math.min(0.08,depth/5),'bottle','bottle');
                    }
                }
            }
            // A wall-mounted mixed unit has physical boards without floor legs.
            if (item.type === 'haengeregal') for (const side of [-1,1]) {
                box(x+side*width*0.37,base+0.1,z-depth/2+t,t,0.18,t,'frame','wall-bracket');
            }
        } else if (item.type === 'regal') {
            frame();
            for (let i=0;i<=bayCount;i++) board(base + (height-t)*i/bayCount + t/2);

        } else if (item.type === 'haengeregal') {
            for (let i=0;i<bayCount;i++) board(base + t/2 + height*i/bayCount);
            for (const side of [-1,1]) {
                const front = rotate(item);
                const bx = front===90 || front===270 ? x + (front===90 ? 1 : -1)*(width/2-t) : x+side*width*0.37;
                const bz = front===0 || front===180 ? z + (front===0 ? -1 : 1)*(depth/2-t) : z+side*depth*0.37;
                box(bx,base+t*1.8,bz,t,limit(height*0.24,0.07,0.22),t,'frame','wall-bracket');
            }
        } else if (item.type === 'vitrine') {
            frame();
            for (let i=0;i<=bayCount;i++) board(base+(height-t)*i/bayCount+t/2);
            frontPlane(0,base+height/2,Number(item.width),height,t*0.7,'glass','glass-front');
        } else if (item.type === 'kommode') {
            box(x,base+height/2,z,width,height,depth,'cabinet','body');
            for (let i=0;i<bayCount;i++) frontPlane(0,base+height*(i+0.5)/bayCount,
                Number(item.width)-t*2,height/bayCount-t*1.8,t,'drawer','drawer');
        } else {
            box(x,base+height/2,z,width,height,depth,'cabinet','body');
            if (item.type === 'schrank') {
                for (const side of [-1,1]) frontPlane(side*Number(item.width)/4,base+height/2,
                    Number(item.width)/2-t*1.6,height-t*1.6,t*0.8,'door','door');
            }
        }
        // Optional side and rear boards are independent of shelf fronts. The
        // local left/right orientation rotates with the furniture's front.
        if (item.leftSidePanel === true || item.rightSidePanel === true) {
            for (const [side,enabled,role] of [[-1,item.leftSidePanel,'left-side-panel'],[1,item.rightSidePanel,'right-side-panel']]) {
                if (!enabled) continue;
                box(x + sideX * side * (Number(item.width)/2 - t/2),base+height/2,
                    z + sideZ * side * (Number(item.width)/2 - t/2),
                    Math.abs(sideX) ? t : Number(item.depth),height,
                    Math.abs(sideZ) ? t : Number(item.depth),'back',role);
            }
        }
        if (item.backPanel === true) {
            box(x-frontX*(Number(item.depth)/2-t/2),base+height/2,
                z-frontZ*(Number(item.depth)/2-t/2),
                Math.abs(frontX) ? t : Number(item.width),height,
                Math.abs(frontZ) ? t : Number(item.width),'back','back-panel');
        }
        // Legacy shelves retain their original equal-height bottle placement.
        if (!individual && ['regal','vitrine','haengeregal'].includes(item.type)) {
            shelves.forEach((shelf,i) => {
                const amount = Math.min(4,count.get(shelf.id) || 0);
                const bayHeight = height/bayCount;
                const bottleHeight = limit(bayHeight * 0.65,0.055,0.22);
                for (let j=0;j<amount;j++) {
                    const along = ((j+1)/(amount+1)-0.5)*Number(item.width)*0.8;
                    const px = x+sideX*along;
                    const py = base+bayHeight*i+t+bottleHeight/2;
                    const pz = z+sideZ*along;
                    box(px,py,pz,Math.min(0.09,width/10),bottleHeight,Math.min(0.08,depth/5),'bottle','bottle');
                }
            });
        }
        objects.push(result);
    }
    return {objects,roomWidth:Number(room.width),roomDepth:Number(room.height),
        maxHeight: Math.max(2.5,...(room.furniture||[]).map(f=>(Number(f.elevation)||0)+(Number(f.itemHeight)||1.8)))};
}

(() => {
console.log('game.js starting');

const canvas = document.getElementById('canvas');
const reticleDiv = document.getElementById('reticle');
const connStatus = document.getElementById('connStatus');
const retXY = document.getElementById('retXY');
const abc = document.getElementById('abc');
const debugConsole = document.getElementById('debugConsole');

let cw = canvas.width = window.innerWidth;
let ch = canvas.height = window.innerHeight;
function resize() { cw = canvas.width = window.innerWidth; ch = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);

// WebSocket setup
const WS_URL = `wss://${window.location.hostname}:8080`;
const ws = new WebSocket(WS_URL);
ws.onopen = () => { connStatus.textContent = 'WS: connected'; ws.send(JSON.stringify({ type:'register', client:'game' })); };
ws.onclose = () => { connStatus.textContent = 'WS: disconnected'; };
ws.onerror = (e) => { connStatus.textContent = 'WS: error'; console.error(e); };
// ---------------------------------------------------
// PC SIMULATION: control reticle + fire/reload on game.html
// ---------------------------------------------------
// ---------------------------------------------------
// DESKTOP MOUSE SIMULATION (game.html controls)
// ---------------------------------------------------
(function setupDesktopControls() {
    console.log("Desktop control simulation ON");

    // store last known mouse position
    let lastX = 0;
    let lastY = 0;

    // helper to send full payload
    function sendDesktopPayload(overrides = {}) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const payload = {
            x: lastX,
            y: lastY,
            alpha: 0,
            beta: 0,
            gamma: 0,
            fire: false,
            reload: false,
            calibrate: false,
            ...overrides // overrides like fire/reload
        };

        ws.send(JSON.stringify({
            type: "controller",
            payload
        }));
    }

    // mouse movement updates x/y
    window.addEventListener("mousemove", (e) => {
        lastX = (e.clientX / window.innerWidth) * 2 - 1;
        lastY = (e.clientY / window.innerHeight) * 2 - 1;

        sendDesktopPayload(); // send full payload with new x/y
    });

    // left click → fire
    window.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
            const fireSound = new Audio('sounds/fire.ogg');
  fireSound.play();
			sendDesktopPayload({ fire: true });
        }
    });

    // right click → reload
    window.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const reloadSound = new Audio('sounds/reload.ogg');
  reloadSound.play();
		sendDesktopPayload({ reload: true });
    });

})();

function logDebug(msg) {
    const ts = new Date().toLocaleTimeString();
    debugConsole.textContent = `${ts} - ${msg}\n` + debugConsole.textContent;
    debugConsole.textContent = debugConsole.textContent.split('\n').slice(0,200).join('\n');
}

// ------------------ Three.js Setup ------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, cw / ch, 0.1, 100);
camera.position.set(0, 1.7, 5);
camera.lookAt(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(cw, ch);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// ------------------ Reticle Tracking ------------------
let ret = { x: cw/2, y: ch/2 };         // target position from controller
let displayedRet = { x: cw/2, y: ch/2 }; // position actually shown on screen
const LERP_SPEED = 0.9;

// ------------------ Raycaster ------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ------------------ Targets ------------------
const targets = [];
const targetGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const targetMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });

function addTarget(x,y,z) {
    const t = new THREE.Mesh(targetGeo, targetMat.clone());
    t.position.set(x, y, z);
    t.userData.health = 3;
    scene.add(t);
    targets.push(t);
}

// Add test targets
addTarget(0,1.5,0);
addTarget(1.5,1.2,-2);
addTarget(-1.2,1.0,-1.5);
addTarget(0.8,1.8,-3);

// ------------------ Duck & Zoom ------------------
let ducking = false;
let zoomed = false;
document.addEventListener('keydown', (e) => {
    if(e.key==='Shift') ducking=true;
    if(e.key==='z' || e.key==='Z') zoomed=true;
});
document.addEventListener('keyup', (e) => {
    if(e.key==='Shift') ducking=false;
    if(e.key==='z' || e.key==='Z') zoomed=false;
});

// ------------------ Fire ------------------
function fire() {
    mouse.x = (ret.x / cw) * 2 - 1;
    mouse.y = - (ret.y / ch) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(targets);
    if(hits.length > 0) {
        const obj = hits[0].object;
        obj.userData.health--;
        logDebug(`Hit target at ${obj.position.x.toFixed(2)},${obj.position.y.toFixed(2)},${obj.position.z.toFixed(2)} | Health: ${obj.userData.health}`);
        if(obj.userData.health <= 0){
            scene.remove(obj);
            targets.splice(targets.indexOf(obj),1);
            logDebug('Target destroyed!');
        }
    } else {
        logDebug('Miss!');
    }
}

// Mouse click to test firing
canvas.addEventListener('mousedown', fire);

// ------------------ WebSocket input ------------------
ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);

    if(msg.type==='registered'){ logDebug(`WS registered ${msg.client}`); return; }

    if(msg.type==='controller') {
        const p = msg.payload;
        ret.x = ((p.x+1)/2)*cw;
        ret.y = ((p.y+1)/2)*ch;
        retXY.textContent = `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`;
        abc.textContent = `${p.alpha?.toFixed(1)}, ${p.beta?.toFixed(1)}, ${p.gamma?.toFixed(1)}`;
        if(p.fire) fire();
    }
};

// ------------------ Animation Loop ------------------
function animate(){
    requestAnimationFrame(animate);

    // Lerp displayed reticle toward controller input
    displayedRet.x += (ret.x - displayedRet.x) * LERP_SPEED;
    displayedRet.y += (ret.y - displayedRet.y) * LERP_SPEED;
    reticleDiv.style.left = `${displayedRet.x}px`;
    reticleDiv.style.top = `${displayedRet.y}px`;

    // Ducking & zoom
    camera.position.y = 1.7 - (ducking ? 0.8 : 0);
    camera.fov = zoomed ? 30 : 60;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
}

animate();

})();

// js/game.js

//-------------------------------------------------------
// DEBUG HUD
//-------------------------------------------------------
window.TILT_SENSITIVITY = 5; // how many units per degree of tilt
window.LERP_SPEED = 0.2;     // smooth motion factor (0.0–1.0)

const debugDiv = document.createElement('div');
debugDiv.style.position = 'absolute';
debugDiv.style.top = '10px';
debugDiv.style.left = '10px';
debugDiv.style.padding = '10px';
debugDiv.style.background = 'rgba(0,0,0,0.6)';
debugDiv.style.color = 'lime';
debugDiv.style.fontSize = '16px';
debugDiv.style.zIndex = '9999';
debugDiv.style.whiteSpace = 'pre-wrap';
debugDiv.innerText = 'Debug HUD initialized...';
document.body.appendChild(debugDiv);

function dbg(msg) {
    console.log(msg);
    debugDiv.innerText = msg;
}

//-------------------------------------------------------
// SCENE
//-------------------------------------------------------
let scene, camera, renderer;
let reticle, target;
let targetRadius = 0.5;
let ws;

// Reticle target coordinates
let reticleX = 0;
let reticleY = 0;

//-------------------------------------------------------
// AUDIO
//-------------------------------------------------------
let backgroundMusic = new Audio('sounds/background.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;
backgroundMusic.play().catch(() => {});

let hitSound = new Audio('sounds/hit.ogg');

//-------------------------------------------------------
// INIT
//-------------------------------------------------------
function init() {
    dbg("Initializing scene...");

    scene = new THREE.Scene();

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    document.body.appendChild(renderer.domElement);

    //-------------------------------------------------------
    // RETICLE
    //-------------------------------------------------------
    const reticleGeometry = new THREE.CircleGeometry(0.1, 32);
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.position.z = 0;
    scene.add(reticle);

    //-------------------------------------------------------
    // TARGET
    //-------------------------------------------------------
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        'images/target.png',
        (texture) => {
            dbg("Target loaded");
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            target = new THREE.Sprite(spriteMaterial);
            target.position.set(0, 0, 0);
            target.scale.set(1, 1, 1);
            scene.add(target);
        },
        undefined,
        (err) => dbg("Target load error: " + err)
    );

    //-------------------------------------------------------
    // WEBSOCKET
    //-------------------------------------------------------
    const wsURL = `wss://${window.location.hostname}:8080`;
    dbg("Connecting WebSocket: " + wsURL);

    ws = new WebSocket(wsURL);

    ws.onopen = () => {
        dbg("WS OPEN — registering as game");
        ws.send(JSON.stringify({ type: "register", client: "game" }));
    };

    ws.onerror = (err) => dbg("WS ERROR: " + JSON.stringify(err));
    ws.onclose = () => dbg("WS CLOSED");

    ws.onmessage = (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            dbg("Invalid WS JSON");
            return;
        }

        if (data.type === "controller") {
            handleControllerOrientation(data.payload);
        }
    };

    window.addEventListener("resize", onWindowResize);

    animate();
}

//-------------------------------------------------------
// HANDLE ORIENTATION INPUT
//-------------------------------------------------------
function handleControllerOrientation(payload) {
    const { alpha, beta, gamma, fire, reload, calibrate } = payload;

    // Calibration can be added if needed
    // Adjust reticle target positions using TILT_SENSITIVITY
    reticleX = gamma * window.TILT_SENSITIVITY;
    reticleY = beta * window.TILT_SENSITIVITY;

    // Debug info
    dbg(
        `alpha=${alpha.toFixed(1)} beta=${beta.toFixed(1)} gamma=${gamma.toFixed(1)}\n` +
        `reticleX=${reticleX.toFixed(2)} reticleY=${reticleY.toFixed(2)}\n` +
        `fire=${fire} reload=${reload} calibrate=${calibrate}`
    );

    // Fire
    if (fire) {
        checkHit();
        ws.send(JSON.stringify({ type: 'audio', payload: { sound: 'gunfire' } }));
    }

    // Reload
    if (reload) {
        ws.send(JSON.stringify({ type: 'audio', payload: { sound: 'reload' } }));
    }
}

//-------------------------------------------------------
// HIT CHECK
//-------------------------------------------------------
function checkHit() {
    if (!target) return;
    const dx = reticle.position.x - target.position.x;
    const dy = reticle.position.y - target.position.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < targetRadius) {
        dbg("HIT!");
        hitSound.currentTime = 0;
        hitSound.play();
    }
}

//-------------------------------------------------------
// WINDOW RESIZE
//-------------------------------------------------------
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

//-------------------------------------------------------
// ANIMATION LOOP
//-------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);

    // Smooth reticle motion
    reticle.position.x += (reticleX - reticle.position.x) * window.LERP_SPEED;
    reticle.position.y += (reticleY - reticle.position.y) * window.LERP_SPEED;

    renderer.render(scene, camera);
}

//-------------------------------------------------------
// START
//-------------------------------------------------------
init();

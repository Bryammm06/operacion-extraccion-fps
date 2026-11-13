import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// --------------------------------------------
// 1. CONFIGURACIÓN BÁSICA DE ESCENA Y CÁMARA (RF06)
// --------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11151c);
scene.fog = new THREE.Fog(0x11151c, 10, 85); // Niebla para ambientación apocalíptica

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.7, 0); // Altura de ojos del jugador en Zona Inicial (Z = 0)

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffdddd, 1.0);
dirLight.position.set(10, 25, 10);
scene.add(dirLight);

// --------------------------------------------
// 2. ESTADO DEL JUEGO Y VARIABLES (RF01, RF02)
// --------------------------------------------
let gameActive = false;
let gameEnded = false;

// RF02: Contadores independientes de munición por arma
const ammo = {
    1: 6, // Arma 1 empieza con 6 balas
    2: 4  // Arma 2 empieza con 4 balas
};
let currentWeapon = 1; // 1 o 2

// Referencias a los modelos de las armas en 1ra persona
let weaponModel1 = null;
let weaponModel2 = null;

// Elementos del HUD en HTML
const weaponNameEl = document.getElementById('weapon-name');
const ammoCountEl = document.getElementById('ammo-count');
const startScreen = document.getElementById('start-screen');
const victoryScreen = document.getElementById('victory-screen');
const gameoverScreen = document.getElementById('gameover-screen');

function updateHUD() {
    weaponNameEl.textContent = currentWeapon === 1 ? 'Arma 1 (Principal)' : 'Arma 2 (Secundaria)';
    ammoCountEl.textContent = ammo[currentWeapon];
}

// --------------------------------------------
// 3. CONTROLES FPS (WASD + MOUSE) (RF06)
// --------------------------------------------
const controls = new PointerLockControls(camera, document.body);
// Añadimos la cámara a la escena para que las armas hijas de la cámara se vean
scene.add(camera);

startScreen.addEventListener('click', () => {
    if (!gameEnded) controls.lock();
});

controls.addEventListener('lock', () => {
    if (!gameEnded) {
        gameActive = true;
        startScreen.classList.add('hidden');
    }
});

controls.addEventListener('unlock', () => {
    if (!gameEnded) {
        gameActive = false;
        startScreen.classList.remove('hidden');
    }
});

const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;

    // RF01: Cambio de arma con Tecla 1 y Tecla 2
    if (gameActive && !gameEnded) {
        if (e.code === 'Digit1') switchWeapon(1);
        if (e.code === 'Digit2') switchWeapon(2);
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

function switchWeapon(num) {
    currentWeapon = num;
    if (weaponModel1) weaponModel1.visible = (num === 1);
    if (weaponModel2) weaponModel2.visible = (num === 2);
    updateHUD();
}

// --------------------------------------------
// 4. CONSTRUCCIÓN DEL MUNDO 3D Y PROGRESIÓN (RF03, RF08, RF11)
// --------------------------------------------
// Escenario: Corredor militar/urbano de 130 metros de largo (desde Z = 5 hasta Z = -125)
const obstacles = []; // Guardamos muros y barricadas para colisión del jugador

// Suelo
const floorGeo = new THREE.PlaneGeometry(24, 140);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b2d2f });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, -60);
scene.add(floor);

// Paredes laterales y traseras del corredor
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d4337 });
function createWall(w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    obstacles.push(new THREE.Box3().setFromObject(mesh));
}

createWall(1, 6, 140, -12, 3, -60); // Pared Izquierda
createWall(1, 6, 140, 12, 3, -60);  // Pared Derecha
createWall(24, 6, 1, 0, 3, 8);      // Pared Trasera (Detrás del inicio)
createWall(24, 6, 1, 0, 3, -128);   // Pared Final (Fondo de extracción)

// RF03 y RF11: Obstáculos / barricadas a lo largo del recorrido para obligar a esquivar
const crateMat = new THREE.MeshStandardMaterial({ color: 0x6e5034 });
const barricadePositions = [
    [-5, 1.5, -18], [5, 1.5, -28], [0, 1.5, -42],
    [-6, 1.5, -58], [6, 1.5, -72], [-2, 1.5, -88], [4, 1.5, -102]
];
barricadePositions.forEach(([x, y, z]) => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2.5), crateMat);
    box.position.set(x, y, z);
    scene.add(box);
    obstacles.push(new THREE.Box3().setFromObject(box));
});

// RF08: Zona de Extracción al final del recorrido (Z = -120)
const extractionZonePos = new THREE.Vector3(0, 0.1, -120);
const extractGeo = new THREE.CylinderGeometry(4, 4, 0.3, 32);
const extractMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00aa44,
    transparent: true,
    opacity: 0.8
});
const extractionPad = new THREE.Mesh(extractGeo, extractMat);
extractionPad.position.copy(extractionZonePos);
scene.add(extractionPad);

// Luz verde sobre la zona de extracción para identificarla desde lejos
const extractLight = new THREE.PointLight(0x00ff88, 5, 25);
extractLight.position.set(0, 4, -120);
scene.add(extractLight);

// --------------------------------------------
// 5. OBJETOS COLECCIONABLES: CAJAS DE MUNICIÓN (RF02, RF10)
// --------------------------------------------
const ammoPickups = [];
const ammoBoxPositions = [
    new THREE.Vector3(-8, 0.6, -25),
    new THREE.Vector3(8, 0.6, -55),
    new THREE.Vector3(-7, 0.6, -85),
    new THREE.Vector3(7, 0.6, -105)
];

const ammoGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
const ammoMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x004400 });

ammoBoxPositions.forEach((pos) => {
    const box = new THREE.Mesh(ammoGeo, ammoMat);
    box.position.copy(pos);
    scene.add(box);
    ammoPickups.push({ mesh: box, collected: false });
});

// --------------------------------------------
// 6. CARGA DE MODELOS GLB: ARMAS (RF01) Y ZOMBIS (RF04)
// --------------------------------------------
const loader = new GLTFLoader();

// Función auxiliar para normalizar el tamaño de cualquier modelo GLB descargado
function normalizeModel(model, targetHeight) {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
        const scale = targetHeight / maxDim;
        model.scale.setScalar(scale);
    }
}

// RF01: Cargar Arma 1 (.glb) y anclarla a la cámara en 1ra persona
loader.load('./models/arma1.glb', (gltf) => {
    weaponModel1 = gltf.scene;
    normalizeModel(weaponModel1, 0.45);
    // Posición abajo a la derecha de la vista en primera persona
    weaponModel1.position.set(0.35, -0.3, -0.6);
    weaponModel1.rotation.y = Math.PI; // Ajustar si el modelo mira hacia atrás
    camera.add(weaponModel1);
    weaponModel1.visible = (currentWeapon === 1);
});

// RF01: Cargar Arma 2 (.glb) y anclarla a la cámara en 1ra persona
loader.load('./models/arma2.glb', (gltf) => {
    weaponModel2 = gltf.scene;
    normalizeModel(weaponModel2, 0.55);
    weaponModel2.position.set(0.35, -0.32, -0.65);
    weaponModel2.rotation.y = Math.PI;
    camera.add(weaponModel2);
    weaponModel2.visible = (currentWeapon === 2);
});

// RF04 y RF05: Cargar Zombis (.glb) y distribuirlos estratégicamente en el nivel
const zombies = [];
const zombieSpawnPositions = [
    new THREE.Vector3(0, 0, -22),
    new THREE.Vector3(-6, 0, -36),
    new THREE.Vector3(6, 0, -48),
    new THREE.Vector3(-4, 0, -65),
    new THREE.Vector3(5, 0, -78),
    new THREE.Vector3(-5, 0, -94),
    new THREE.Vector3(4, 0, -100),
    new THREE.Vector3(0, 0, -112)
];

loader.load('./models/zombie.glb', (gltf) => {
    const baseZombie = gltf.scene;
    normalizeModel(baseZombie, 2.0); // Altura de 2 metros

    zombieSpawnPositions.forEach((pos, index) => {
        // Clonamos el modelo GLB para cada enemigo
        const zombieMesh = SkeletonUtils.clone(baseZombie);
        zombieMesh.position.copy(pos);

        // Creamos una caja de colisión invisible dentro del zombie
        const hitboxGeo = new THREE.BoxGeometry(1.2, 2.2, 1.2);
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.position.y = 1.1;
        zombieMesh.add(hitbox);

        scene.add(zombieMesh);

        zombies.push({
            mesh: zombieMesh,
            hitbox: hitbox,
            hp: 2,                  // RF07: Exactamente 2 puntos de resistencia
            alive: true,
            active: false,          // RF05: Empieza en estado INACTIVO
            detectionRange: 22,     // RF05: Se activa solo cuando el jugador se acerca a 22m
            speed: 3.8 + (index % 2) * 0.8 // RF11: Variación de velocidad para dificultad
        });
    });
});

// --------------------------------------------
// 7. SISTEMA DE DISPAROS Y COLISIONES (RF01, RF02, RF07)
// --------------------------------------------
const raycaster = new THREE.Raycaster();

// RF01: "mousedown" genera un único disparo por clic (no dispara en automático al mantener presionado)
window.addEventListener('mousedown', (e) => {
    // e.button === 0 es el clic izquierdo
    if (e.button !== 0 || !gameActive || gameEnded) return;

    // RF02: Verificar si hay munición disponible en el arma actual
    if (ammo[currentWeapon] <= 0) {
        return; // Bloquea el disparo si el contador llega a cero
    }

    // RF02: Consumir 1 unidad de munición
    ammo[currentWeapon]--;
    updateHUD();

    // Efecto visual simple de retroceso en el arma equipada
    const activeWeaponMesh = currentWeapon === 1 ? weaponModel1 : weaponModel2;
    if (activeWeaponMesh) {
        activeWeaponMesh.position.z += 0.12;
        setTimeout(() => { activeWeaponMesh.position.z -= 0.12; }, 90);
    }

    // RF07: Lanzar rayo desde el centro exacto de la cámara (coordenadas 0, 0)
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Obtener las hitboxes únicamente de los zombis vivos
    const activeHitboxes = zombies.filter(z => z.alive).map(z => z.hitbox);
    const intersects = raycaster.intersectObjects(activeHitboxes, false);

    if (intersects.length > 0) {
        // Encontrar a qué zombi pertenece el hitbox impactado
        const hitObject = intersects[0].object;
        const hitZombie = zombies.find(z => z.hitbox === hitObject);

        if (hitZombie && hitZombie.alive) {
            // RF07: Reducir resistencia en 1 unidad por impacto válido
            hitZombie.hp -= 1;

            // Empujón visual para notar que le dimos
            hitZombie.mesh.position.z -= 0.6;

            // RF07: El zombi muere exactamente al segundo impacto válido (hp <= 0)
            if (hitZombie.hp <= 0) {
                hitZombie.alive = false;
                hitZombie.active = false;
                // Tumbar al zombi en el suelo y dejar de perseguir
                hitZombie.mesh.rotation.x = -Math.PI / 2;
                hitZombie.mesh.position.y = 0.2;
            }
        }
    }
});

// --------------------------------------------
// 8. BUCLE PRINCIPAL DEL JUEGO (GAME LOOP)
// --------------------------------------------
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (gameActive && !gameEnded) {
        // --- A. MOVIMIENTO DEL JUGADOR (WASD) Y COLISIÓN CON MUROS (RF06) ---
        const moveSpeed = 7.5 * delta;
        const oldPosition = camera.position.clone();

        if (keys.KeyW) controls.moveForward(moveSpeed);
        if (keys.KeyS) controls.moveForward(-moveSpeed);
        if (keys.KeyA) controls.moveRight(-moveSpeed);
        if (keys.KeyD) controls.moveRight(moveSpeed);

        // Caja de colisión del jugador para no atravesar paredes ni obstáculos
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            camera.position,
            new THREE.Vector3(1.0, 1.8, 1.0)
        );

        for (const obs of obstacles) {
            if (playerBox.intersectsBox(obs)) {
                camera.position.copy(oldPosition); // Revertir si choca con pared/barricada
                break;
            }
        }

        // --- B. RECOLECCIÓN DE CAJAS DE MUNICIÓN (RF02, RF10) ---
        ammoPickups.forEach(item => {
            if (!item.collected) {
                item.mesh.rotation.y += 2 * delta; // Rotación visual
                const dist = camera.position.distanceTo(item.mesh.position);
                if (dist < 2.0) {
                    item.collected = true;
                    item.mesh.visible = false;
                    // Recargar balas en ambas armas al recoger la caja
                    ammo[1] += 4;
                    ammo[2] += 3;
                    updateHUD();
                }
            }
        });

        // --- C. COMPORTAMIENTO DE ZOMBIS Y GAME OVER (RF05, RF09) ---
        zombies.forEach(z => {
            if (!z.alive) return; // Si está muerto, no hace nada (RF07)

            // Distancia en el plano horizontal entre el zombi y el jugador
            const playerHorizontalPos = new THREE.Vector3(camera.position.x, 0, camera.position.z);
            const zombieHorizontalPos = new THREE.Vector3(z.mesh.position.x, 0, z.mesh.position.z);
            const distance = playerHorizontalPos.distanceTo(zombieHorizontalPos);

            // RF05: Activar zombi únicamente cuando el jugador entra a su rango de detección
            if (!z.active && distance <= z.detectionRange) {
                z.active = true;
            }

            // RF05: Si está activo, orientarse y desplazarse hacia el jugador
            if (z.active) {
                z.mesh.lookAt(camera.position.x, z.mesh.position.y, camera.position.z);

                const direction = new THREE.Vector3()
                    .subVectors(playerHorizontalPos, zombieHorizontalPos)
                    .normalize();

                z.mesh.position.addScaledVector(direction, z.speed * delta);

                // RF09: Condición de derrota (Game Over) si el zombi alcanza al jugador
                if (distance < 1.3) {
                    gameEnded = true;
                    gameActive = false;
                    controls.unlock();
                    gameoverScreen.classList.remove('hidden');
                }
            }
        });

        // --- D. CONDICIÓN DE VICTORIA: ZONA DE EXTRACCIÓN (RF08) ---
        const distToExtraction = new THREE.Vector2(camera.position.x, camera.position.z)
            .distanceTo(new THREE.Vector2(extractionZonePos.x, extractionZonePos.z));

        if (distToExtraction < 4.0) {
            gameEnded = true;
            gameActive = false;
            controls.unlock();
            victoryScreen.classList.remove('hidden');
        }
    }

    renderer.render(scene, camera);
}

// Ajustar ventana si cambia de tamaño
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
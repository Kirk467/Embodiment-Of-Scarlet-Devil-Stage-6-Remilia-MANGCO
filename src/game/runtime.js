import * as THREE from 'three';
import { MMDAnimationHelper } from 'three/addons/animation/MMDAnimationHelper.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { createCameraControls } from '../input/cameraControls.js';
import {
    activateAudio,
    playKnifeShotSound,
    playLaserShotSound,
    requestScarletStartSound,
    startSpellcardAudio
} from '../audio/audioManager.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const PLAYER_SPAWN_POSITION = new THREE.Vector3(10, -60, 120);
const PLAYER_LOOK_TARGET = new THREE.Vector3(-3, 0, -8);
camera.position.copy(PLAYER_SPAWN_POSITION);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(renderer.domElement);

const { controls, updateCameraControls } = createCameraControls(
    camera,
    renderer.domElement,
    PLAYER_LOOK_TARGET,
    activateAudio,
    startPlayerShooting,
    stopPlayerShooting,
    activateBomb
);

// ==========================================
// LIGHTING
// ==========================================

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const redLight = new THREE.PointLight(0xff0033, 30);
redLight.position.set(-4, 3, 4);
scene.add(redLight);

const purpleLight = new THREE.PointLight(0x9900ff, 20);
purpleLight.position.set(4, -2, 3);
scene.add(purpleLight);

const knifeSunLight = new THREE.DirectionalLight(0xffffff, 3);
knifeSunLight.position.set(-6, 10, 8);
scene.add(knifeSunLight);

const bigBenSunLight = new THREE.DirectionalLight(0xffdfbd, 5);
bigBenSunLight.position.set(100, 0, 0);
bigBenSunLight.target.position.set(0, -110, -8);
scene.add(bigBenSunLight, bigBenSunLight.target);

const bigBenCloudBounce = new THREE.DirectionalLight(0xff2418, 3);
bigBenCloudBounce.position.set(100, -220, 100);
bigBenCloudBounce.target.position.set(0, -80, -8);
scene.add(bigBenCloudBounce, bigBenCloudBounce.target);

// ==========================================
// RED CLOUD LAYER
// ==========================================

const CLOUD_LAYER_HEIGHT = -160;
const CLOUD_LAYER_DEPTH = -220;
const CLOUD_LAYER_WIDTH = 2500;
const CLOUD_LAYER_THICKNESS = 120;
const CLOUD_LAYER_DEPTH_EXTENT = 800;
const CLOUD_RAY_STEPS = 64;
const CLOUD_DENSITY = 0.007;
const CLOUD_SHAPE_SCALE = 0.02;
const CLOUD_EDGE_SOFTNESS = 0.13;
const CLOUD_SIDE_EDGE_FADE = 180.0;
const CLOUD_DEPTH_EDGE_FADE = 90.0;
const CLOUD_VERTICAL_EDGE_FADE = 22.0;

const cloudVolumeGeometry = new THREE.BoxGeometry(
    CLOUD_LAYER_WIDTH,
    CLOUD_LAYER_THICKNESS,
    CLOUD_LAYER_DEPTH_EXTENT
);
const cloudVolumeMaterials = [];
const cloudBoundsMin = new THREE.Vector3(
    -CLOUD_LAYER_WIDTH / 2,
    -CLOUD_LAYER_THICKNESS / 2,
    -CLOUD_LAYER_DEPTH_EXTENT / 2
);
const cloudBoundsMax = new THREE.Vector3(
    CLOUD_LAYER_WIDTH / 2,
    CLOUD_LAYER_THICKNESS / 2,
    CLOUD_LAYER_DEPTH_EXTENT / 2
);

const cloudVolumeVertexShader = `
    varying vec3 vLocalPosition;

    void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix *
            vec4(position, 1.0);
    }
`;

const cloudVolumeFragmentShader = `
    uniform vec3 uCameraLocal;
    uniform vec3 uBoundsMin;
    uniform vec3 uBoundsMax;
    uniform float uTime;
    uniform float uCloudScale;
    uniform float uOpacity;
    varying vec3 vLocalPosition;

    float hash3(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float noise3(vec3 p) {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float n000 = hash3(cell);
        float n100 = hash3(cell + vec3(1.0, 0.0, 0.0));
        float n010 = hash3(cell + vec3(0.0, 1.0, 0.0));
        float n110 = hash3(cell + vec3(1.0, 1.0, 0.0));
        float n001 = hash3(cell + vec3(0.0, 0.0, 1.0));
        float n101 = hash3(cell + vec3(1.0, 0.0, 1.0));
        float n011 = hash3(cell + vec3(0.0, 1.0, 1.0));
        float n111 = hash3(cell + vec3(1.0, 1.0, 1.0));

        float x00 = mix(n000, n100, f.x);
        float x10 = mix(n010, n110, f.x);
        float x01 = mix(n001, n101, f.x);
        float x11 = mix(n011, n111, f.x);
        return mix(mix(x00, x10, f.y), mix(x01, x11, f.y), f.z);
    }

    float cloudNoise(vec3 p) {
        float sum = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 4; octave++) {
            sum += noise3(p) * amplitude;
            p = p * 2.03 + vec3(13.7, 9.2, 5.4);
            amplitude *= 0.5;
        }
        return sum / 0.9375;
    }

    void main() {
        vec3 rayDirection = normalize(vLocalPosition - uCameraLocal);
        vec3 inverseDirection = 1.0 / rayDirection;
        vec3 firstPlane = (uBoundsMin - uCameraLocal) * inverseDirection;
        vec3 secondPlane = (uBoundsMax - uCameraLocal) * inverseDirection;
        vec3 nearPlane = min(firstPlane, secondPlane);
        vec3 farPlane = max(firstPlane, secondPlane);
        float rayStart = max(max(nearPlane.x, nearPlane.y), nearPlane.z);
        float rayEnd = min(min(farPlane.x, farPlane.y), farPlane.z);
        rayStart = max(rayStart, 0.0);

        if (rayEnd <= rayStart) {
            discard;
        }

        float stepLength = (rayEnd - rayStart) / ${CLOUD_RAY_STEPS.toFixed(1)};
        float jitter = fract(sin(dot(gl_FragCoord.xy,
            vec2(12.9898, 78.233))) * 43758.5453);
        float travel = rayStart + stepLength * jitter;
        vec3 accumulatedColor = vec3(0.0);
        float accumulatedAlpha = 0.0;
        vec3 wind = vec3(uTime * 0.1, 0.0, -uTime * 0.22);

        for (int stepIndex = 0; stepIndex < ${CLOUD_RAY_STEPS}; stepIndex++) {
            if (travel >= rayEnd || accumulatedAlpha > 0.97) {
                break;
            }

            vec3 samplePosition = uCameraLocal +
                rayDirection * travel;
            vec3 noisePosition = samplePosition * uCloudScale + wind;
            float baseShape = cloudNoise(noisePosition);
            float detail = noise3(noisePosition * 3.2 + vec3(4.0));
            float height = clamp(
                (samplePosition.y - uBoundsMin.y) /
                    (uBoundsMax.y - uBoundsMin.y),
                0.0,
                1.0
            );
            float threshold = mix(0.42, 0.68, height);
            float density = smoothstep(
                threshold - ${CLOUD_EDGE_SOFTNESS.toFixed(2)},
                threshold + 0.12,
                baseShape + (detail - 0.5) * 0.58
            );
            density *= mix(1.0, 0.72, height);

            vec3 edgeDistance = min(
                samplePosition - uBoundsMin,
                uBoundsMax - samplePosition
            );
            float sideFade = smoothstep(
                0.0,
                ${CLOUD_SIDE_EDGE_FADE.toFixed(1)},
                edgeDistance.x
            );
            float depthFade = smoothstep(
                0.0,
                ${CLOUD_DEPTH_EDGE_FADE.toFixed(1)},
                edgeDistance.z
            );
            float verticalFade = smoothstep(
                0.0,
                ${CLOUD_VERTICAL_EDGE_FADE.toFixed(1)},
                edgeDistance.y
            );
            density *= sideFade * depthFade * verticalFade;

            float sampleAlpha =
                (1.0 - exp(-density * stepLength * ${CLOUD_DENSITY.toFixed(4)})) * uOpacity;
            vec3 deepRed = vec3(0.28, 0.002, 0.009);
            vec3 litRed = vec3(1.4, 0.018, 0.035);
            float lighting = clamp(
                0.62 + height * 0.55 + (detail - 0.5) * 0.5,
                0.0,
                1.0
            );
            vec3 cloudColor = mix(deepRed, litRed, lighting);

            accumulatedColor +=
                (1.0 - accumulatedAlpha) * cloudColor * sampleAlpha;
            accumulatedAlpha +=
                (1.0 - accumulatedAlpha) * sampleAlpha;
            travel += stepLength;
        }

        if (accumulatedAlpha < 0.01) {
            discard;
        }

        gl_FragColor = vec4(accumulatedColor, accumulatedAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

function createRedCloudVolume(height, centerZ, opacity, scale) {

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uCameraLocal: { value: new THREE.Vector3() },
            uBoundsMin: { value: cloudBoundsMin },
            uBoundsMax: { value: cloudBoundsMax },
            uTime: { value: Math.random() * 100 },
            uCloudScale: { value: scale },
            uOpacity: { value: opacity }
        },
        vertexShader: cloudVolumeVertexShader,
        fragmentShader: cloudVolumeFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide
    });
    const volume = new THREE.Mesh(cloudVolumeGeometry, material);

    volume.position.set(0, height, centerZ);
    volume.renderOrder = 1;
    scene.add(volume);
    cloudVolumeMaterials.push({ material, volume });
}

createRedCloudVolume(
    CLOUD_LAYER_HEIGHT,
    CLOUD_LAYER_DEPTH,
    1,
    CLOUD_SHAPE_SCALE
);

// ==========================================
// REMILIA SCARLET
// ==========================================

// Model by Kinishan (design by Banpai Akira); pose 7 by Snorlaxin.
const remiliaTarget = new THREE.Object3D();
remiliaTarget.position.copy(PLAYER_LOOK_TARGET);
scene.add(remiliaTarget);

const remiliaMaterials = [];
const mmdLoader = new MMDLoader();
const mmdAnimationHelper = new MMDAnimationHelper();

mmdLoader.load(
    'assets/models/remilia/Remilia Scarlet ver1.02.pmx',
    (mesh) => {
        mmdLoader.loadVPD(
            'assets/models/pose-pack/7.vpd',
            false,
            (pose) => {
                const modelBoneNames = new Set(
                    mesh.skeleton.bones.map((bone) => bone.name)
                );
                const matchedBones = pose.bones.filter((bone) =>
                    modelBoneNames.has(bone.name)
                ).length;

                if (matchedBones === 0) {
                    console.error(
                        'Pose 7 has no bones compatible with the Remilia model.'
                    );
                    return;
                }

                mmdAnimationHelper.pose(mesh, pose);

                const bounds = new THREE.Box3().setFromObject(mesh);
                const size = bounds.getSize(new THREE.Vector3());
                if (bounds.isEmpty() || size.y === 0) {
                    console.error('Remilia PMX has no usable geometry.');
                    return;
                }

                const modelScale = 20 / size.y;
                mesh.scale.setScalar(modelScale);
                mesh.position.copy(remiliaTarget.position)
                    .addScaledVector(
                        bounds.getCenter(new THREE.Vector3()),
                        -modelScale
                    );
                mesh.traverse((child) => {
                    if (!child.isMesh) {
                        return;
                    }

                    const materials = Array.isArray(child.material)
                        ? child.material
                        : [child.material];
                    remiliaMaterials.push(...materials);
                });
                scene.add(mesh);
            },
            undefined,
            (error) => {
                console.error('Could not load Remilia pose 7:', error);
            }
        );
    },
    undefined,
    (error) => {
        console.error(
            'Could not load Remilia PMX at assets/models/remilia/Remilia Scarlet ver1.02.pmx:',
            error
        );
    }
);

const bigBenLoader = new GLTFLoader();
bigBenLoader.load(
    'assets/models/clock_tower_big_ben.glb',
    (gltf) => {
        const bigBen = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(bigBen);
        const size = bounds.getSize(new THREE.Vector3());
        const groundY = CLOUD_LAYER_HEIGHT - CLOUD_LAYER_THICKNESS / 2;
        const tipY = -5;

        if (bounds.isEmpty() || size.y === 0) {
            console.error('Big Ben GLB has no usable geometry.');
            return;
        }

        bigBen.scale.setScalar((tipY - groundY) / size.y);
        const scaledBounds = new THREE.Box3().setFromObject(bigBen);
        const center = scaledBounds.getCenter(new THREE.Vector3());
        bigBen.position.set(
            -center.x,
            groundY - scaledBounds.min.y,
            -8 - center.z
        );
        bigBen.traverse((child) => {
            if (!child.isMesh) {
                return;
            }

            const materials = Array.isArray(child.material)
                ? child.material
                : [child.material];
            materials.forEach((material) => {
                if ('envMapIntensity' in material) {
                    material.envMapIntensity = 1.5;
                }
            });
        });
        scene.add(bigBen);
    },
    undefined,
    (error) => {
        console.error(
            'Could not load Big Ben GLB at assets/models/clock_tower_big_ben.glb:',
            error
        );
    }
);

const PLAYER_SHOT_SPEED = 90;
const PLAYER_SHOT_INTERVAL = 0.16;
const PLAYER_SHOT_LANE_OFFSET = 0.85;
const PLAYER_SHOT_HIT_RADIUS = 1.35;
const playerShots = [];
const playerShotGeometry = new THREE.BoxGeometry(1.0, 0.72, 0.035);
const playerShotTrailGeometry = new THREE.BufferGeometry();
playerShotTrailGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
        -0.42, -0.32, -0.04,
         0.42, -0.32, -0.04,
         0.00, -2.8,  -0.04
    ], 3)
);
playerShotTrailGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute([
        0.8, 0.25, 1,
        0.8, 0.25, 1,
        0.12, 0.02, 0.35
    ], 3)
);
const playerShotTrailMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
});
let playerShotCooldown = 0;
let playerShooting = false;
let nextPlayerShotSide = -1;
let remiliaHitFlash = 0;
const BOMB_ORB_APPROACH_DURATION = 30;
const BOMB_COOLDOWN = 3.5;
const BOMB_DISC_SPIN_SPEED = 0.3;
const BOMB_IMPACT_DURATION = 0.8;
const BOMB_IMPACT_RING_COUNT = 3;
const BOMB_IMPACT_MAX_RADIUS = 28;
let activeBomb = null;
let bombCooldown = 0;

function createBombGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const center = 256;

    context.beginPath();
    context.arc(center, center, 218, 0, Math.PI * 2);
    context.shadowColor = '#63e5ff';
    context.shadowBlur = 42;
    context.strokeStyle = 'rgba(126, 235, 255, 0.95)';
    context.lineWidth = 12;
    context.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const bombYinYangTexture = new THREE.TextureLoader().load(
    'assets/textures/1280px-Yin_and_Yang_symbol.svg.webp',
    (texture) => {
        const image = texture.image;
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);

        const imageData = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        );
        const pixels = imageData.data;
        for (let index = 0; index < pixels.length; index += 4) {
            const lightness = (
                pixels[index] +
                pixels[index + 1] +
                pixels[index + 2]
            ) / (3 * 255);
            pixels[index] = THREE.MathUtils.lerp(0x65, 0xf5, lightness);
            pixels[index + 1] = THREE.MathUtils.lerp(0xdf, 0xfd, lightness);
            pixels[index + 2] = THREE.MathUtils.lerp(0xff, 0xff, lightness);
        }

        context.putImageData(imageData, 0, 0);
        texture.image = canvas;
        texture.needsUpdate = true;
    },
    undefined,
    (error) => {
        console.error(
            'Could not load Yin-Yang texture at assets/textures/1280px-Yin_and_Yang_symbol.svg.webp:',
            error
        );
    }
);
bombYinYangTexture.colorSpace = THREE.SRGBColorSpace;
const bombGlowTexture = createBombGlowTexture();

function createBombImpactFlashTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 124);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.52, 'rgba(235, 251, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(210, 245, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const bombImpactFlashTexture = createBombImpactFlashTexture();

function createBombScreenWipe(worldPosition) {
    const projectedPosition = worldPosition.clone().project(camera);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uCenter: {
                value: new THREE.Vector2(
                    projectedPosition.x * 0.5 + 0.5,
                    projectedPosition.y * 0.5 + 0.5
                )
            },
            uAspect: { value: camera.aspect },
            uProgress: { value: 0 },
            uOpacity: { value: 0.9 }
        },
        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix *
                    vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec2 uCenter;
            uniform float uAspect;
            uniform float uProgress;
            uniform float uOpacity;
            varying vec2 vUv;

            void main() {
                vec2 centeredUv = (vUv - uCenter) *
                    vec2(uAspect, 1.0);
                float distanceFromImpact = length(centeredUv);
                vec2 farthestCorner = max(
                    abs(uCenter),
                    abs(vec2(1.0) - uCenter)
                ) * vec2(uAspect, 1.0);
                float maxRadius = length(farthestCorner) * 1.08;
                float radius = uProgress * maxRadius;
                float edge = maxRadius * 0.035;
                float coverage = 1.0 - smoothstep(
                    radius - edge,
                    radius + edge,
                    distanceFromImpact
                );
                float fade = 1.0 - uProgress * 0.65;
                gl_FragColor = vec4(
                    vec3(0.88, 0.97, 1.0),
                    coverage * uOpacity * fade
                );
            }
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
    });
    const wipe = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        material
    );
    wipe.position.set(0, 0, -0.5);
    wipe.scale.x = camera.aspect;
    wipe.renderOrder = 10003;
    scene.add(camera);
    camera.add(wipe);
    return wipe;
}

function clearEnemyBullets() {
    bullets.forEach((bullet) => {
        scene.remove(bullet.mesh);
        bullet.mesh.material.dispose();
    });
    bullets.length = 0;
    pendingOrbShots.length = 0;
    orbShotTimer = ORB_SHOT_INTERVAL;
}

function activateBomb() {
    if (activeBomb || bombCooldown > 0) {
        return;
    }

    camera.updateMatrixWorld();

    const discGeometry = new THREE.CircleGeometry(1, 64);
    const discMaterial = new THREE.MeshBasicMaterial({
        map: bombYinYangTexture,
        color: 0xffffff,
        transparent: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
        toneMapped: false
    });
    const glowGeometry = new THREE.PlaneGeometry(2.35, 2.35);
    const glowMaterial = new THREE.MeshBasicMaterial({
        map: bombGlowTexture,
        color: 0xa9f2ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
    });
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = 0.02;
    const bomb = new THREE.Group();
    bomb.add(glow, disc);
    const towardPlayer = camera.getWorldPosition(new THREE.Vector3())
        .sub(remiliaTarget.position)
        .normalize();
    const start = remiliaTarget.position.clone()
        .add(new THREE.Vector3(0, 1000, 0))
        .addScaledVector(towardPlayer, 500);
    const end = remiliaTarget.getWorldPosition(new THREE.Vector3());
    bomb.position.copy(start);
    bomb.quaternion.copy(camera.quaternion);
    bomb.scale.setScalar(1.25);
    scene.add(bomb);

    activeBomb = {
        mesh: bomb,
        disc,
        geometry: discGeometry,
        glowGeometry,
        materials: [discMaterial, glowMaterial],
        start,
        end,
        age: 0,
        startScale: 50,
        endScale: 1000
    };
    bombCooldown = BOMB_COOLDOWN;
    requestScarletStartSound();
}

function updateBomb(delta) {
    bombCooldown = Math.max(0, bombCooldown - delta);
    if (!activeBomb) {
        return;
    }

    const bomb = activeBomb;

    if (bomb.phase === 'impact') {
        bomb.age += delta;
        const progress = Math.min(bomb.age / BOMB_IMPACT_DURATION, 1);
        bomb.screenWipe.material.uniforms.uProgress.value = progress;
        bomb.rings.forEach((ring, index) => {
            const ringProgress = THREE.MathUtils.clamp(
                progress * 1.5 - index * 0.2,
                0,
                1
            );
            const radius = 0.1 + ringProgress * BOMB_IMPACT_MAX_RADIUS;
            ring.scale.set(radius, radius * 0.82, 1);
            ring.material.opacity = 1 - progress;
        });

        const flashProgress = Math.min(progress * 2.2, 1);
        bomb.flash.scale.setScalar(1 + flashProgress * BOMB_IMPACT_MAX_RADIUS * 0.8);
        bomb.flash.material.opacity = Math.max(0, 1 - progress * 2.5);

        if (progress >= 1) {
            scene.remove(bomb.effect);
            bomb.rings.forEach((ring) => {
                ring.geometry.dispose();
                ring.material.dispose();
            });
            bomb.flash.material.dispose();
            camera.remove(bomb.screenWipe);
            scene.remove(camera);
            bomb.screenWipe.geometry.dispose();
            bomb.screenWipe.material.dispose();
            activeBomb = null;
        }

        return;
    }

    bomb.age += delta;
    const progress = Math.min(
        bomb.age / BOMB_ORB_APPROACH_DURATION,
        1
    );
    bomb.mesh.position.lerpVectors(bomb.start, bomb.end, progress);
    bomb.mesh.quaternion.copy(camera.quaternion);
    bomb.disc.rotation.z += delta * BOMB_DISC_SPIN_SPEED;

    const exponentialGrowth = Math.exp(Math.log(
        bomb.endScale / bomb.startScale
    ) * progress);
    bomb.mesh.scale.setScalar(bomb.startScale * exponentialGrowth);

    if (progress >= 1) {
        remiliaHitFlash = 0.35;
        clearEnemyBullets();
        camera.updateMatrixWorld();
        scene.remove(bomb.mesh);
        bomb.geometry.dispose();
        bomb.glowGeometry.dispose();
        bomb.materials.forEach((material) => material.dispose());

        const effect = new THREE.Group();
        effect.position.copy(bomb.end);
        effect.quaternion.copy(camera.quaternion);
        const rings = [];

        for (let i = 0; i < BOMB_IMPACT_RING_COUNT; i++) {
            const geometry = new THREE.TorusGeometry(1, 0.075, 10, 96);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                toneMapped: false
            });
            const ring = new THREE.Mesh(geometry, material);
            ring.renderOrder = 10001;
            effect.add(ring);
            rings.push(ring);
        }

        const flashMaterial = new THREE.SpriteMaterial({
            map: bombImpactFlashTexture,
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        const flash = new THREE.Sprite(flashMaterial);
        flash.renderOrder = 10002;
        flash.scale.set(0.1, 0.1, 1);
        effect.add(flash);
        scene.add(effect);

        activeBomb = {
            phase: 'impact',
            age: 0,
            effect,
            rings,
            flash,
            screenWipe: createBombScreenWipe(bomb.end)
        };
    }
}

function startPlayerShooting() {
    playerShooting = true;
    playerShotCooldown = 0;
}

function stopPlayerShooting() {
    playerShooting = false;
}

function firePlayerShot() {
    camera.updateMatrixWorld();
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const cameraRight = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrixWorld, 0)
        .normalize();
    const side = nextPlayerShotSide;
    nextPlayerShotSide *= -1;
    const target = remiliaTarget.getWorldPosition(new THREE.Vector3())
        .addScaledVector(cameraRight, side * PLAYER_SHOT_LANE_OFFSET);
    const spawnPosition = origin.clone()
        .addScaledVector(cameraRight, side * 0.18);
    const direction = target.sub(spawnPosition).normalize();
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false
    });
    const trailMaterial = playerShotTrailMaterial.clone();
    const shot = new THREE.Group();
    const paper = new THREE.Mesh(playerShotGeometry, material);
    const trail = new THREE.Mesh(playerShotTrailGeometry, trailMaterial);
    shot.add(trail, paper);
    shot.position.copy(spawnPosition).addScaledVector(direction, 1.25);
    shot.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
    );
    scene.add(shot);

    playerShots.push({
        mesh: shot,
        materials: [material, trailMaterial],
        velocity: direction.multiplyScalar(PLAYER_SHOT_SPEED),
        age: 0,
        lifetime: 3
    });
    playKnifeShotSound();
}

function updatePlayerShots(delta) {
    playerShotCooldown = Math.max(0, playerShotCooldown - delta);
    if (playerShooting && playerShotCooldown === 0) {
        firePlayerShot();
        playerShotCooldown = PLAYER_SHOT_INTERVAL;
    }

    remiliaHitFlash = Math.max(0, remiliaHitFlash - delta);
    remiliaMaterials.forEach((material) => {
        material.emissiveIntensity = remiliaHitFlash * 3;
    });

    for (let i = playerShots.length - 1; i >= 0; i--) {
        const shot = playerShots[i];
        shot.age += delta;

        const hitPosition = remiliaTarget.getWorldPosition(new THREE.Vector3());
        const playerShotDirection = hitPosition.clone()
            .sub(shot.mesh.position);
        if (playerShotDirection.lengthSq() > 0) {
            shot.velocity.copy(
                playerShotDirection.normalize().multiplyScalar(
                    PLAYER_SHOT_SPEED
                )
            );
            shot.mesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                shot.velocity.clone().normalize()
            );
        }

        const previousPosition = shot.mesh.position.clone();
        const nextPosition = previousPosition.clone().addScaledVector(
            shot.velocity,
            delta
        );
        const segment = nextPosition.clone().sub(previousPosition);
        const segmentLengthSquared = segment.lengthSq();
        const hitProgress = segmentLengthSquared > 0
            ? THREE.MathUtils.clamp(
                hitPosition.clone().sub(previousPosition).dot(segment) /
                    segmentLengthSquared,
                0,
                1
            )
            : 0;
        const closestPoint = previousPosition.addScaledVector(
            segment,
            hitProgress
        );
        const hitRemilia = closestPoint.distanceTo(hitPosition) <=
            PLAYER_SHOT_HIT_RADIUS;

        shot.mesh.position.copy(nextPosition);

        if (hitRemilia) {
            remiliaHitFlash = 0.18;
        }

        if (hitRemilia || shot.age >= shot.lifetime) {
            scene.remove(shot.mesh);
            shot.materials.forEach((material) => material.dispose());
            playerShots.splice(i, 1);
        }
    }
}

// ==========================================
// SKYBOX
// ==========================================

const skyboxLoader = new THREE.CubeTextureLoader();
skyboxLoader.load(
    [
        'assets/textures/testskye2_skybox/converted/rt.jpg',
        'assets/textures/testskye2_skybox/converted/lf.jpg',
        'assets/textures/testskye2_skybox/converted/up.jpg',
        'assets/textures/testskye2_skybox/converted/dn.jpg',
        'assets/textures/testskye2_skybox/converted/bk.jpg',
        'assets/textures/testskye2_skybox/converted/ft.jpg'
    ],
    (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
        scene.environment = texture;
    },
    undefined,
    (error) => {
        console.error('Could not load skybox faces:', error);
    }
);

// ==========================================
// SMALL RED TRAIL BULLET TEXTURE
// ==========================================

function createSmallBulletTexture() {

    const canvas = document.createElement('canvas');

    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');

    const glow = ctx.createRadialGradient(
        64, 64, 20,
        64, 64, 62
    );

    glow.addColorStop(0, 'rgba(255, 0, 20, 0.7)');
    glow.addColorStop(0.7, 'rgba(255, 0, 20, 0.35)');
    glow.addColorStop(1, 'rgba(255, 0, 20, 0)');

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);

    ctx.beginPath();
    ctx.arc(64, 64, 37, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(64, 64, 37, 0, Math.PI * 2);
    ctx.strokeStyle = '#a00016';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(64, 64, 30, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff7777';
    ctx.lineWidth = 2;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

// ==========================================
// LARGE PURPLE ORB TEXTURE
// ==========================================

function createLargeOrbTexture(coreColors = [
    '#211a32',
    '#8f315f',
    '#f00010',
    'rgba(255, 25, 35, 0.9)',
    'rgba(255, 50, 60, 0)'
]) {

    const canvas = document.createElement('canvas');

    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');

    const outerGlow = ctx.createRadialGradient(128, 128, 58, 128, 128, 125);
    outerGlow.addColorStop(0, 'rgba(255, 35, 45, 0.2)');
    outerGlow.addColorStop(0.75, 'rgba(255, 75, 80, 0.35)');
    outerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, 256, 256);
    ctx.beginPath();
    ctx.arc(128, 128, 105, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const core = ctx.createRadialGradient(128, 128, 0, 128, 128, 88);
    core.addColorStop(0, coreColors[0]);
    core.addColorStop(0.38, coreColors[1]);
    core.addColorStop(0.72, coreColors[2]);
    core.addColorStop(0.92, coreColors[3]);
    core.addColorStop(1, coreColors[4]);
    ctx.beginPath();
    ctx.arc(128, 128, 88, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

// ==========================================
// MATERIALS
// ==========================================

const smallBulletTexture = createSmallBulletTexture();
const largeOrbTexture = createLargeOrbTexture();
const purpleLargeOrbTexture = createLargeOrbTexture([
    '#24000a',
    '#a00032',
    '#ff315c',
    'rgba(255, 95, 125, 0.9)',
    'rgba(255, 145, 165, 0)'
]);
const magicCircleTexture = new THREE.TextureLoader().load(
    'assets/textures/MagicCircle_White_800x.png',
    undefined,
    undefined,
    (error) => {
        console.error(
            'Could not load magic circle texture at assets/textures/MagicCircle_White_800x.png:',
            error
        );
    }
);
magicCircleTexture.colorSpace = THREE.SRGBColorSpace;
const magicCircleBaseColor = new THREE.Color(0xff6685);
const magicCircleFlashColor = new THREE.Color(0xffffff);
const sideMagicCircleBaseColor = new THREE.Color(0xff8299);

const smallBulletMaterial = new THREE.SpriteMaterial({
    map: smallBulletTexture,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
});

const largeOrbMaterial = new THREE.SpriteMaterial({
    map: largeOrbTexture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.NormalBlending,
    depthWrite: false
});

const magicCircleMaterial = new THREE.SpriteMaterial({
    map: magicCircleTexture,
    color: magicCircleBaseColor,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const sideMagicCircleMaterial = new THREE.SpriteMaterial({
    map: magicCircleTexture,
    color: sideMagicCircleBaseColor,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

// ==========================================
// MAGIC PROJECTILE GEOMETRYy
// ==========================================

const fallbackMagicProjectileGeometry = new THREE.ConeGeometry(
    1,
    15,
    8
);

const laserGlowGeometry = new THREE.CylinderGeometry(10.5, 10.5, 1, 8);
const laserCoreGeometry = new THREE.CylinderGeometry(3, 3, 1, 8);

const knifeProjectileMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffd4e4,
    transparent: true,
    opacity: 1,
    metalness: 0.78,
    roughness: 0.2,
    envMapIntensity: 1.4,
    clearcoat: 0.6,
    clearcoatRoughness: 0.16,
    depthWrite: false
});

const spearProjectileMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    metalness: 0.82,
    roughness: 0.18,
    envMapIntensity: 1.6,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    depthWrite: false
});

const spearOutlineMaterial = new THREE.MeshBasicMaterial({
    color: 0xf5407f,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false
});

const spearTexture = new THREE.TextureLoader().load(
    'assets/textures/RemiliaSpearV2Low_Texture.png',
    undefined,
    undefined,
    (error) => {
        console.error(
            'Could not load spear texture at assets/textures/RemiliaSpearV2Low_Texture.png:',
            error
        );
    }
);
spearTexture.colorSpace = THREE.SRGBColorSpace;
spearProjectileMaterial.map = spearTexture;

let magicProjectileTemplate = null;
let knifeProjectileTemplate = null;
const objLoader = new OBJLoader();
objLoader.load(
    'assets/models/RemiliaSpearV2Low.obj',
    (object) => {
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const modelLength = Math.max(size.x, size.y, size.z);

        if (bounds.isEmpty() || modelLength === 0) {
            console.error('Spear OBJ has no usable geometry.');
            return;
        }

        object.position.sub(bounds.getCenter(new THREE.Vector3()));
        const modelMeshes = [];
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = spearProjectileMaterial;
                modelMeshes.push(child);
            }
        });

        modelMeshes.forEach((mesh) => {
            const outline = new THREE.Mesh(
                mesh.geometry,
                spearOutlineMaterial
            );
            outline.scale.setScalar(1.035);
            outline.renderOrder = 1;
            outline.userData.projectileOutline = true;
            mesh.add(outline);
        });

        const orientedModel = new THREE.Group();
        orientedModel.scale.setScalar(12 / modelLength);
        orientedModel.add(object);

        magicProjectileTemplate = new THREE.Group();
        magicProjectileTemplate.add(orientedModel);
    },
    undefined,
    (error) => {
        console.error(
            'Could not load spear OBJ at assets/models/RemiliaSpearV2Low.obj:',
            error
        );
    }
);

const stlLoader = new STLLoader();
stlLoader.load(
    'assets/models/Dagger_Touhou_V1.stl',
    (geometry) => {
        geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        const size = bounds.getSize(new THREE.Vector3());
        const longestAxis = size.x >= size.y && size.x >= size.z
            ? 'x'
            : size.z > size.y
                ? 'z'
                : 'y';

        geometry.translate(
            -(bounds.min.x + bounds.max.x) / 2,
            -(bounds.min.y + bounds.max.y) / 2,
            -(bounds.min.z + bounds.max.z) / 2
        );

        if (longestAxis === 'x') {
            geometry.rotateZ(Math.PI / 2);
        } else if (longestAxis === 'z') {
            geometry.rotateX(-Math.PI / 2);
        }

        const modelLength = Math.max(size.x, size.y, size.z);
        if (modelLength === 0) {
            console.error('Knife STL has no usable geometry.');
            geometry.dispose();
            return;
        }

        geometry.scale(7.5 / modelLength, 7.5 / modelLength, 7.5 / modelLength);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        knifeProjectileTemplate = new THREE.Mesh(
            geometry,
            knifeProjectileMaterial
        );
    },
    undefined,
    (error) => {
        console.error(
            'Could not load knife STL at assets/models/Dagger_Touhou_V1.stl:',
            error
        );
    }
);

// ==========================================
// BULLET CONFIGURATION
// ==========================================

const ORB_SHOT_INTERVAL = 0.4;
const bullets = [];
const pendingOrbShots = [];
let orbShotTimer = ORB_SHOT_INTERVAL;

const emitterPosition = new THREE.Vector3(0, 4.5, 0);

const SMALL_BULLET_SIZE = 3.6;
const SMALL_BULLET_SPEED = 6;
const SMALL_BULLET_LIFETIME = 15;
const SMALL_BULLET_MAX_DISTANCE = 90;

const LARGE_ORB_SIZE = 10;
const LARGE_ORB_SPEED = 12;
const CIRCULAR_ORB_SPEED = 18;
const LARGE_ORB_LIFETIME = 40;
const LARGE_ORB_MAX_DISTANCE = 180;

const TRAIL_INTERVAL = 0.35;
const TRAIL_SCATTER_DELAY = 1.2;
const TRAIL_FADE_START = 0.45;

const ORB_CURVE_SPEED = 1.0;

// ==========================================
// MAGIC CIRCLE CONFIGURATION
// ==========================================

const magicCircles = [];
const magicProjectiles = [];
const sideMagicCircles = [];
const sideMagicCircleFireOrder = [];
let sideMagicAttackActive = false;
let sideMagicAttackPhase = 'idle';
let sideMagicPhaseTimer = 0;
let sideMagicShotTimer = 0;
let nextSideMagicCircleToFire = 0;
let lastSideMagicCircleFired = -1;
let sideMagicShotsFired = 0;

let magicPhase = 'appearing';
let magicPhaseTimer = 0;

// Change this value to control the number of circles DONT FIOGET
const MAGIC_CIRCLE_COUNT = 66;

const MAGIC_CIRCLE_SIZE = 10;
const REMILIA_ATTACK_CIRCLE_GROW_DURATION = 4;
const REMILIA_ATTACK_CIRCLE_MAX_SIZE = 60;
const REMILIA_ATTACK_CIRCLE_OPACITY = 0.67;

const MAGIC_ARRIVAL_TIME = 2.0;
const MAGIC_STAGGER_DELAY = 0.1;

const MAGIC_FIRE_DURATION = 10;
const BOMB_MAGIC_FIRE_DURATION = 50;
const MAGIC_FADE_DURATION = 1.5;
const SIDE_MAGIC_APPEAR_DELAY = 5;

const MAGIC_SHOT_INTERVAL = 0.02;
const MAGIC_SHOT_SPEED = 200;
const MAGIC_CIRCLE_FLASH_DURATION = 0.3;
const BOMB_MAGIC_CIRCLE_COUNT = 141;
const BOMB_MAGIC_SUMMON_INTERVAL = 0.05;
const BOMB_MAGIC_SHOT_INTERVAL = 0.001;
const BOMB_MAGIC_ARRIVAL_TIME = 0.3;
const magicCircleFireOrder = [];
let nextMagicCircleToFire = 0;
let lastMagicCircleFired = -1;
let magicShotTimer = 0;
let magicShotsFired = 0;
let remiliaAttackCircle = null;
let remiliaAttackCircleAge = 0;

function getMagicCircleCount() {
    return activeBomb ? BOMB_MAGIC_CIRCLE_COUNT : MAGIC_CIRCLE_COUNT;
}

function getMagicStaggerDelay() {
    return activeBomb
        ? BOMB_MAGIC_SUMMON_INTERVAL
        : MAGIC_STAGGER_DELAY;
}

function getMagicArrivalTime() {
    return activeBomb ? BOMB_MAGIC_ARRIVAL_TIME : MAGIC_ARRIVAL_TIME;
}

function getMagicShotInterval() {
    return activeBomb
        ? BOMB_MAGIC_SHOT_INTERVAL
        : MAGIC_SHOT_INTERVAL;
}

function getMagicFireDuration() {
    return activeBomb ? BOMB_MAGIC_FIRE_DURATION : MAGIC_FIRE_DURATION;
}

function createRemiliaAttackCircle() {
    const material = new THREE.SpriteMaterial({
        map: magicCircleTexture,
        color: 0xff1838,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        toneMapped: false
    });

    remiliaAttackCircle = new THREE.Sprite(material);
    remiliaAttackCircle.position.copy(remiliaTarget.position);
    remiliaAttackCircle.position.addScaledVector(
        camera.getWorldDirection(new THREE.Vector3()),
        5
    );
    remiliaAttackCircle.scale.set(0.1, 0.1, 1);
    remiliaAttackCircle.renderOrder = 1;
    remiliaAttackCircleAge = 0;
    scene.add(remiliaAttackCircle);
}

function updateRemiliaAttackCircle(delta) {
    if (!remiliaAttackCircle) {
        return;
    }

    remiliaAttackCircleAge += delta;
    const progress = Math.min(
        remiliaAttackCircleAge / REMILIA_ATTACK_CIRCLE_GROW_DURATION,
        1
    );
    const eased = 1 - Math.pow(1 - progress, 3);
    const size = THREE.MathUtils.lerp(
        0.1,
        REMILIA_ATTACK_CIRCLE_MAX_SIZE,
        eased
    );

    remiliaAttackCircle.scale.set(size, size, 1);
    remiliaAttackCircle.position.copy(remiliaTarget.position)
        .addScaledVector(
            camera.getWorldDirection(new THREE.Vector3()),
            5
        );
    remiliaAttackCircle.material.opacity =
        REMILIA_ATTACK_CIRCLE_OPACITY * eased;
    remiliaAttackCircle.material.rotation += delta * 0.12;
}

function shuffleMagicCircleFireOrder() {

    magicCircleFireOrder.length = magicCircles.length;

    for (let i = 0; i < magicCircles.length; i++) {
        magicCircleFireOrder[i] = i;
    }

    for (let i = magicCircleFireOrder.length - 1; i > 0; i--) {
        const swapIndex = Math.floor(Math.random() * (i + 1));
        [
            magicCircleFireOrder[i],
            magicCircleFireOrder[swapIndex]
        ] = [
            magicCircleFireOrder[swapIndex],
            magicCircleFireOrder[i]
        ];
    }

    if (magicCircleFireOrder.length > 1 &&
        magicCircleFireOrder[0] === lastMagicCircleFired) {
        const swapIndex = 1 + Math.floor(
            Math.random() * (magicCircleFireOrder.length - 1)
        );
        [
            magicCircleFireOrder[0],
            magicCircleFireOrder[swapIndex]
        ] = [
            magicCircleFireOrder[swapIndex],
            magicCircleFireOrder[0]
        ];
    }

    nextMagicCircleToFire = 0;
}

// ==========================================
// CREATE MAGIC CIRCLES
// ==========================================

function createMagicCircles() {

    const circleSpacing = MAGIC_CIRCLE_SIZE + 1.5;
    let ringIndex = 1;
    let pointInRing = 0;
    let pointsInRing = Math.floor(
        (2 * Math.PI * ringIndex * circleSpacing * 1.1) / circleSpacing
    );

    const targetCount = getMagicCircleCount();
    for (let i = 0; i < targetCount; i++) {

        if (pointInRing >= pointsInRing) {
            ringIndex++;
            pointInRing = 0;
            pointsInRing = Math.floor(
                (2 * Math.PI * ringIndex * circleSpacing * 1.1) /
                circleSpacing
            );
        }

        const radius = ringIndex * circleSpacing * 1.1;
        const ringOffset = ringIndex % 2 === 0
            ? Math.PI / pointsInRing
            : 0;
        const angle =
            (pointInRing / pointsInRing) * Math.PI * 2 + ringOffset;

        const depthOffset = Math.sin(angle * 3 + ringIndex * 0.7) * 4;
        const startPosition = new THREE.Vector3(0, 0, 0);
        const targetPosition = new THREE.Vector3(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius + 1,
            depthOffset
        );
        pointInRing++;

        if (i < magicCircles.length) {
            continue;
        }

        const material = magicCircleMaterial.clone();
        material.opacity = 0;
        const circle = new THREE.Sprite(material);
        circle.scale.set(0.1, 0.1, 1);

        const direction = targetPosition.clone()
            .sub(startPosition)
            .normalize();
        const perpendicular = new THREE.Vector3(
            -direction.y,
            direction.x,
            0
        );
        const bend = (i % 2 === 0 ? 1 : -1) *
            Math.min(radius * 0.25, 6);
        const controlPosition = startPosition.clone()
            .add(targetPosition)
            .multiplyScalar(0.5)
            .addScaledVector(perpendicular, bend);

        const alreadyFiring = magicPhase === 'firing';
        circle.position.copy(
            alreadyFiring ? targetPosition : startPosition
        );
        if (alreadyFiring) {
            circle.scale.set(MAGIC_CIRCLE_SIZE, MAGIC_CIRCLE_SIZE, 1);
            material.opacity = 1;
        }

        scene.add(circle);

        magicCircles.push({
            mesh: circle,
            start: startPosition,
            target: targetPosition,
            control: controlPosition,
            delay: i,
            shotFlash: 0,
            arrived: alreadyFiring
        });
    }
}

// ==========================================
// ARC MOVEMENT
// ==========================================

function getArcPosition(start, control, end, t) {

    const inverse = 1 - t;

    return new THREE.Vector3()
        .addScaledVector(start, inverse * inverse)
        .addScaledVector(control, 2 * inverse * t)
        .addScaledVector(end, t * t);
}

function createSideMagicCircles() {

    const targetCount = getMagicCircleCount();
    const circlesPerSide = Math.ceil(targetCount / 2);
    let columns = 1;
    while ((columns * (columns + 1)) / 2 <= circlesPerSide) {
        columns++;
    }
    columns--;
    const remainingCircles =
        circlesPerSide - (columns * (columns + 1)) / 2;
    const sideLayouts = [-1, 1].map(side => {
        const positions = [];

        for (let column = 0; column < columns; column++) {
            const circlesInColumn = columns - column +
                Number(column >= columns - remainingCircles);

            for (let row = 0; row < circlesInColumn; row++) {
                positions.push(new THREE.Vector3(
                    side * (32 + column * 28 + (Math.random() - 0.5) * 8),
                    (row - (circlesInColumn - 1) / 2) * 14 +
                        (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 12
                ));
            }
        }

        for (let i = positions.length - 1; i > 0; i--) {
            const swapIndex = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[swapIndex]] =
                [positions[swapIndex], positions[i]];
        }

        return positions;
    });

    for (let i = sideMagicCircles.length; i < targetCount; i++) {

        const sideIndex = Math.floor(i / 2);
        const side = i % 2 === 0 ? -1 : 1;
        const material = sideMagicCircleMaterial.clone();
        material.opacity = 0;

        const circle = new THREE.Sprite(material);
        circle.scale.set(0.1, 0.1, 1);

        const start = remiliaTarget.position.clone();
        const target = sideLayouts[side === -1 ? 0 : 1][sideIndex];
        const control = start.clone()
            .add(target)
            .multiplyScalar(0.5)
            .add(new THREE.Vector3(
                side * (Math.random() - 0.5) * 5,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 6
            ));

        const alreadyFiring = sideMagicAttackPhase === 'firing';
        circle.position.copy(alreadyFiring ? target : start);
        if (alreadyFiring) {
            circle.scale.set(
                MAGIC_CIRCLE_SIZE,
                MAGIC_CIRCLE_SIZE,
                1
            );
            material.opacity = 1;
        }
        scene.add(circle);

        sideMagicCircles.push({
            mesh: circle,
            start,
            target,
            control,
            delay: i,
            shotFlash: 0
        });
    }
}

function shuffleSideMagicCircleFireOrder() {

    sideMagicCircleFireOrder.length = sideMagicCircles.length;

    for (let i = 0; i < sideMagicCircles.length; i++) {
        sideMagicCircleFireOrder[i] = i;
    }

    for (let i = sideMagicCircleFireOrder.length - 1; i > 0; i--) {
        const swapIndex = Math.floor(Math.random() * (i + 1));
        [
            sideMagicCircleFireOrder[i],
            sideMagicCircleFireOrder[swapIndex]
        ] = [
            sideMagicCircleFireOrder[swapIndex],
            sideMagicCircleFireOrder[i]
        ];
    }

    if (sideMagicCircleFireOrder.length > 1 &&
        sideMagicCircleFireOrder[0] === lastSideMagicCircleFired) {
        const swapIndex = 1 + Math.floor(
            Math.random() * (sideMagicCircleFireOrder.length - 1)
        );
        [
            sideMagicCircleFireOrder[0],
            sideMagicCircleFireOrder[swapIndex]
        ] = [
            sideMagicCircleFireOrder[swapIndex],
            sideMagicCircleFireOrder[0]
        ];
    }

    nextSideMagicCircleToFire = 0;
}

function startSideMagicAttack() {

    requestScarletStartSound();
    sideMagicCircles.forEach((circle) => {
        scene.remove(circle.mesh);
        circle.mesh.material.dispose();
    });
    sideMagicCircles.length = 0;
    createSideMagicCircles();
    sideMagicAttackActive = true;
    sideMagicAttackPhase = 'waiting';
    sideMagicPhaseTimer = 0;
    nextSideMagicCircleToFire = 0;
    lastSideMagicCircleFired = -1;
    sideMagicShotsFired = 0;
}

function updateSideMagicAttack(delta) {

    sideMagicPhaseTimer += delta;
    if (activeBomb && sideMagicAttackPhase !== 'fading' &&
        sideMagicCircles.length < getMagicCircleCount()) {
        const previousCount = sideMagicCircles.length;
        createSideMagicCircles();
        if (sideMagicAttackPhase === 'firing' &&
            sideMagicCircles.length > previousCount) {
            shuffleSideMagicCircleFireOrder();
        }
    }

    if (sideMagicAttackPhase === 'waiting') {
        if (sideMagicPhaseTimer >=
            (activeBomb ? 0 : SIDE_MAGIC_APPEAR_DELAY)) {
            sideMagicAttackPhase = 'appearing';
            sideMagicPhaseTimer = 0;
        }

        return;
    }

    if (sideMagicAttackPhase === 'appearing') {

        let allArrived = true;

        sideMagicCircles.forEach(circle => {

            const localTime = sideMagicPhaseTimer -
                circle.delay * getMagicStaggerDelay();

            if (localTime < 0) {
                allArrived = false;
                return;
            }

            const progress = Math.min(
                localTime / getMagicArrivalTime(),
                1
            );
            const eased = 1 - Math.pow(1 - progress, 3);

            circle.mesh.position.copy(
                getArcPosition(
                    circle.start,
                    circle.control,
                    circle.target,
                    eased
                )
            );
            const size = THREE.MathUtils.lerp(
                0.1,
                MAGIC_CIRCLE_SIZE,
                eased
            );
            circle.mesh.scale.set(size, size, 1);
            circle.mesh.material.opacity = Math.min(progress * 1.5, 1);
            circle.mesh.material.rotation += delta * 0.4;

            if (progress < 1) {
                allArrived = false;
            }
        });

        if (allArrived) {
            sideMagicAttackPhase = 'firing';
            sideMagicPhaseTimer = 0;
            sideMagicShotTimer = getMagicShotInterval();
            shuffleSideMagicCircleFireOrder();
        }

        return;
    }

    if (sideMagicAttackPhase === 'firing') {

        sideMagicShotTimer += delta;

        sideMagicCircles.forEach(circle => {
            circle.shotFlash = Math.max(0, circle.shotFlash - delta);
            const flashProgress =
                1 - circle.shotFlash / MAGIC_CIRCLE_FLASH_DURATION;
            const flash = Math.sin(Math.PI * flashProgress);
            circle.mesh.material.color
                .copy(sideMagicCircleBaseColor)
                .lerp(magicCircleFlashColor, flash);

            const size =
                MAGIC_CIRCLE_SIZE * (1 + flash * 0.12);
            circle.mesh.scale.set(size, size, 1);
        });

        const shotInterval = getMagicShotInterval();
        if (sideMagicCircles.length > 0 &&
            sideMagicShotTimer >= shotInterval) {
            sideMagicShotTimer -= shotInterval;
            const firingCircle =
                sideMagicCircles[
                    sideMagicCircleFireOrder[nextSideMagicCircleToFire]
                ];
            sideMagicShotsFired++;
            fireMagicProjectiles(
                firingCircle.mesh,
                sideMagicShotsFired % 35 === 0,
                true
            );
            firingCircle.shotFlash = MAGIC_CIRCLE_FLASH_DURATION;
            lastSideMagicCircleFired =
                sideMagicCircleFireOrder[nextSideMagicCircleToFire];
            nextSideMagicCircleToFire++;

            if (nextSideMagicCircleToFire >=
                sideMagicCircleFireOrder.length) {
                shuffleSideMagicCircleFireOrder();
            }
        }

        if (sideMagicPhaseTimer >= getMagicFireDuration()) {
            sideMagicAttackPhase = 'fading';
            sideMagicPhaseTimer = 0;
        }

        return;
    }

    if (sideMagicAttackPhase === 'fading') {

        const progress = Math.min(
            sideMagicPhaseTimer / MAGIC_FADE_DURATION,
            1
        );

        sideMagicCircles.forEach(circle => {
            circle.mesh.material.opacity = 1 - progress;
            circle.mesh.material.rotation += delta * 1.5;
        });

        if (progress >= 1) {
            sideMagicCircles.forEach(circle => {
                scene.remove(circle.mesh);
                circle.mesh.material.dispose();
            });
            sideMagicCircles.length = 0;
            sideMagicAttackActive = false;
            sideMagicAttackPhase = 'idle';
            requestScarletStartSound();
            currentWave = 0;
            waveDurationTimer = 0;
            attackTimer = 0;
        }
    }
}

// ==========================================
// MAGIC PROJECTILES
// ==========================================

function fireMagicProjectiles(
    circle,
    fireLaser = false,
    targetBomb = false
) {

    camera.updateMatrixWorld();

    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    const bombTarget = targetBomb
        ? getBombProjectileTarget()
        : null;
    const aimPosition = bombTarget || cameraPosition;

    const direction = new THREE.Vector3()
        .subVectors(aimPosition, circle.position)
        .normalize();

    if (fireLaser) {
        playLaserShotSound();

        const distance = circle.position.distanceTo(aimPosition);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff244f,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xffd5e0,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const beam = new THREE.Group();
        const glow = new THREE.Mesh(laserGlowGeometry, glowMaterial);
        const core = new THREE.Mesh(laserCoreGeometry, coreMaterial);

        beam.position.copy(circle.position).add(aimPosition).multiplyScalar(0.5);
        beam.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction
        );
        glow.scale.y = distance;
        core.scale.y = distance;
        beam.add(glow, core);
        scene.add(beam);

        magicProjectiles.push({
            mesh: beam,
            materials: [glowMaterial, coreMaterial],
            age: 0,
            lifetime: 0.25,
            isLaser: true
        });
        return;
    }

    playKnifeShotSound();

    const useKnife = knifeProjectileTemplate &&
        (!magicProjectileTemplate || Math.random() < 0.5);
    const projectileTemplate = useKnife
        ? knifeProjectileTemplate
        : magicProjectileTemplate;
    const projectileMaterial = useKnife
        ? knifeProjectileMaterial
        : spearProjectileMaterial;
    const projectile = projectileTemplate
        ? projectileTemplate.clone(true)
        : new THREE.Mesh(fallbackMagicProjectileGeometry);
    const materials = [];
    projectile.traverse((child) => {
        if (child.isMesh) {
            child.material = child.userData.projectileOutline
                ? spearOutlineMaterial.clone()
                : projectileMaterial.clone();
            materials.push(child.material);
        }
    });
    projectile.position.copy(circle.position);
    projectile.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
    );

    scene.add(projectile);
    magicProjectiles.push({
        mesh: projectile,
        materials,
        age: 0,
        lifetime: 4,
        velocity: direction.clone().multiplyScalar(MAGIC_SHOT_SPEED),
        targetPosition: cameraPosition,
        targetBomb,
        speed: MAGIC_SHOT_SPEED,
        isLaser: false
    });
}

// ==========================================
// MAGIC CIRCLE INTRODUCTION UPDATE
// ==========================================

function updateMagicIntroduction(delta) {

    if (activeBomb &&
        (magicPhase === 'appearing' || magicPhase === 'firing') &&
        magicCircles.length < getMagicCircleCount()) {
        createMagicCircles();
        if (magicPhase === 'firing') {
            shuffleMagicCircleFireOrder();
        }
    }

    magicPhaseTimer += delta;

    // PHASE 1: CIRCLES ARRIVE ONE BY ONE
    if (magicPhase === 'appearing') {

        let allArrived = true;

        magicCircles.forEach(circle => {

            const localTime =
                magicPhaseTimer -
                circle.delay * getMagicStaggerDelay();

            if (localTime < 0) {

                allArrived = false;
                return;
            }

            const progress = Math.min(
                localTime / getMagicArrivalTime(),
                1
            );

            const eased = 1 - Math.pow(1 - progress, 3);

            // Individually calculated curved path
            const control = circle.control;

            circle.mesh.position.copy(
                getArcPosition(
                    circle.start,
                    control,
                    circle.target,
                    eased
                )
            );

            const circleSize = THREE.MathUtils.lerp(
                0.1,
                MAGIC_CIRCLE_SIZE,
                eased
            );
            circle.mesh.scale.set(circleSize, circleSize, 1);

            circle.mesh.material.opacity = Math.min(
                progress * 1.5,
                1
            );

            circle.mesh.material.rotation += delta * 0.4;

            if (progress < 1) {
                allArrived = false;
            } else {
                circle.arrived = true;
            }
        });

        if (allArrived) {

            magicPhase = 'firing';
            magicPhaseTimer = 0;
            magicShotTimer = getMagicShotInterval();
            lastMagicCircleFired = -1;
            magicShotsFired = 0;
            shuffleMagicCircleFireOrder();
        }
    }

    // PHASE 2: FIRE TOWARD CURRENT CAMERA POSITION
    else if (magicPhase === 'firing') {

        magicShotTimer += delta;

        magicCircles.forEach(circle => {
            circle.shotFlash = Math.max(0, circle.shotFlash - delta);
            const flashProgress =
                1 - circle.shotFlash / MAGIC_CIRCLE_FLASH_DURATION;
            const flash = Math.sin(Math.PI * flashProgress);

            circle.mesh.material.color
                .copy(magicCircleBaseColor)
                .lerp(magicCircleFlashColor, flash);

            const pulseScale = MAGIC_CIRCLE_SIZE * (1 + flash * 0.12);
            circle.mesh.scale.set(pulseScale, pulseScale, 1);
        });

        const shotInterval = getMagicShotInterval();
        if (magicCircles.length > 0 &&
            magicShotTimer >= shotInterval) {
            magicShotTimer -= shotInterval;
            const circleIndex =
                magicCircleFireOrder[nextMagicCircleToFire];
            const firingCircle = magicCircles[circleIndex];
            magicShotsFired++;
            fireMagicProjectiles(
                firingCircle.mesh,
                magicShotsFired % 35 === 0,
                true
            );
            firingCircle.shotFlash = MAGIC_CIRCLE_FLASH_DURATION;
            lastMagicCircleFired = circleIndex;
            nextMagicCircleToFire++;

            if (nextMagicCircleToFire >= magicCircleFireOrder.length) {
                shuffleMagicCircleFireOrder();
            }
        }

        if (magicPhaseTimer >= getMagicFireDuration()) {

            magicPhase = 'fading';
            magicPhaseTimer = 0;
        }
    }

    // PHASE 3: CIRCLES FADE AWAY
    else if (magicPhase === 'fading') {

        const progress = Math.min(
            magicPhaseTimer / MAGIC_FADE_DURATION,
            1
        );

        magicCircles.forEach(circle => {

            circle.mesh.material.opacity = 1 - progress;
            circle.mesh.material.rotation += delta * 1.5;
        });

        if (progress >= 1) {

            magicCircles.forEach(circle => {

                scene.remove(circle.mesh);
                circle.mesh.material.dispose();
            });

            magicCircles.length = 0;

            magicPhase = 'finished';
            requestScarletStartSound();
        }
    }
}

// ==========================================
// UPDATE MAGIC PROJECTILES
// ==========================================

function updateMagicProjectiles(delta) {

    for (let i = magicProjectiles.length - 1; i >= 0; i--) {

        const projectile = magicProjectiles[i];

        projectile.age += delta;

        if (!projectile.isLaser) {
            const bombTarget = projectile.targetBomb
                ? getBombProjectileTarget()
                : null;
            if (bombTarget) {
                const targetDirection = bombTarget.clone()
                    .sub(projectile.mesh.position);
                if (targetDirection.length() <= projectile.speed * delta) {
                    scene.remove(projectile.mesh);
                    projectile.materials.forEach((material) => {
                        material.dispose();
                    });
                    magicProjectiles.splice(i, 1);
                    continue;
                }
                if (targetDirection.lengthSq() > 0) {
                    projectile.velocity.copy(
                        targetDirection.normalize()
                            .multiplyScalar(projectile.speed)
                    );
                    projectile.mesh.quaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 1, 0),
                        projectile.velocity.clone().normalize()
                    );
                }
            }

            projectile.mesh.position.addScaledVector(
                projectile.velocity,
                delta
            );
        }

        const fadeStart = projectile.isLaser
            ? 0
            : 0.65;

        if (projectile.age > fadeStart) {

            const progress = THREE.MathUtils.clamp(
                (projectile.age - fadeStart) /
                (projectile.lifetime - fadeStart),
                0,
                1
            );

            if (projectile.isLaser) {
                projectile.materials[0].opacity = 0.3 * (1 - progress);
                projectile.materials[1].opacity = 0.95 * (1 - progress);
            } else {
                projectile.materials.forEach((material) => {
                    material.opacity = 1 - progress;
                });
            }
        }

        if (
            projectile.age >= projectile.lifetime ||
            (!projectile.targetBomb &&
            !projectile.isLaser &&
            projectile.mesh.position.distanceTo(projectile.targetPosition) <
                projectile.speed * delta
            )
        ) {

            scene.remove(projectile.mesh);
            projectile.materials.forEach((material) => material.dispose());

            magicProjectiles.splice(i, 1);
        }
    }
}

// ==========================================
// ADD SMALL RED TRAIL BULLET
// ==========================================

function addTrailBullet(position, direction) {

    const material = smallBulletMaterial.clone();

    const bullet = new THREE.Sprite(material);

    bullet.position.copy(position);

    bullet.scale.set(
        SMALL_BULLET_SIZE,
        SMALL_BULLET_SIZE,
        1
    );

    scene.add(bullet);

    bullets.push({
        mesh: bullet,

        velocity: direction.clone()
            .normalize()
            .multiplyScalar(SMALL_BULLET_SPEED),

        age: 0,
        lifetime: SMALL_BULLET_LIFETIME,

        type: 'trail',

        scatterTimer: TRAIL_SCATTER_DELAY,
        scattered: false
    });
}

// ==========================================
// ADD LARGE PURPLE ORB
// ==========================================

function addLargeOrb(
    direction,
    speed,
    size = LARGE_ORB_SIZE,
    curveSpeed = ORB_CURVE_SPEED,
    texture = largeOrbTexture
) {

    const material = largeOrbMaterial.clone();
    material.map = texture;
    const orb = new THREE.Sprite(material);

    orb.position.copy(emitterPosition);

    orb.scale.set(size, size, 1);

    scene.add(orb);

    bullets.push({
        mesh: orb,

        velocity: direction.clone()
            .normalize()
            .multiplyScalar(speed),

        age: 0,
        lifetime: LARGE_ORB_LIFETIME,

        type: 'orb',

        trailTimer: 0,

        curving: true,
        angularVelocity: curveSpeed
    });
}

// ==========================================
// CREATE RED TRAIL
// ==========================================

function createTrail(orb) {

    const direction = orb.velocity.clone().normalize();

    const trailPosition = orb.mesh.position.clone().add(
        direction.clone().multiplyScalar(-(orb.mesh.scale.x * 0.5 + 0.1))
    );

    const trailDirection = direction.clone();

    trailDirection.x += (Math.random() - 0.5) * 0.12;
    trailDirection.y += (Math.random() - 0.5) * 0.12;
    trailDirection.z += (Math.random() - 0.5) * 0.12;

    addTrailBullet(
        trailPosition,
        trailDirection
    );
}

// ==========================================
// WAVE 1: ROTATING SPIRAL STREAM
// ==========================================

let waveOneAngle = 0;

function waveOne() {

    const count = 2;

    for (let i = 0; i < count; i++) {

        const angle = waveOneAngle + i * 0.12;

        const direction = new THREE.Vector3(
            Math.cos(angle),
            Math.sin(angle),
            Math.sin(angle * 0.5) * 0.12
        ).normalize();

        addLargeOrb(
            direction,
            LARGE_ORB_SPEED,
            LARGE_ORB_SIZE,
            0.65
        );
    }

    waveOneAngle += 0.22;
}

// ==========================================
// WAVE 2: CIRCLE ROTATING LEFT
// ==========================================

let waveTwoRotation = 0;

function waveTwo() {

    const count = 12;

    for (let i = 0; i < count; i++) {

        const angle =
            (i / count) * Math.PI * 2 + waveTwoRotation;

        const direction = new THREE.Vector3(
            Math.cos(angle),
            Math.sin(angle),
            Math.sin((i / count) * Math.PI * 6) * 0.6
        );

        pendingOrbShots.push({
            direction,
            speed: CIRCULAR_ORB_SPEED,
            size: 8,
            curveSpeed: -0.25,
            texture: purpleLargeOrbTexture
        });
    }

    waveTwoRotation -= 0.12;
}

// ==========================================
// WAVE 3: CIRCLE ROTATING RIGHT
// ==========================================

let waveThreeRotation = 0;

function waveThree() {

    const count = 12;

    for (let i = 0; i < count; i++) {

        const angle =
            (i / count) * Math.PI * 2 + waveThreeRotation;

        const direction = new THREE.Vector3(
            Math.cos(angle),
            Math.sin(angle),
            Math.sin((i / count) * Math.PI * 6) * 0.6
        );

        pendingOrbShots.push({
            direction,
            speed: CIRCULAR_ORB_SPEED,
            size: 5,
            curveSpeed: 0.25,
            texture: purpleLargeOrbTexture
        });
    }

    waveThreeRotation += 0.12;
}

// ==========================================
// WAVE 4: REPEAT WAVE 2
// ==========================================

function waveFour() {
    waveTwo();
}

// ==========================================
// ORB WAVES AND SIDE MAGIC ATTACK
// ==========================================

const WAVE_DURATION = 7;

let currentWave = 0;
let waveDurationTimer = 0;
let attackTimer = 0;
const SPIRAL_SHOT_INTERVAL = 0.2;

const waveFunctions = [
    waveOne,
    waveTwo,
    waveThree,
    waveFour
];

const waveIntervals = [
    SPIRAL_SHOT_INTERVAL,
    6,
    6,
    6
];

function updatePendingOrbShots(delta) {

    if (pendingOrbShots.length === 0) {
        orbShotTimer = ORB_SHOT_INTERVAL;
        return;
    }

    orbShotTimer += delta;

    if (orbShotTimer >= ORB_SHOT_INTERVAL) {
        orbShotTimer -= ORB_SHOT_INTERVAL;
        const shot = pendingOrbShots.shift();

        addLargeOrb(
            shot.direction,
            shot.speed,
            shot.size,
            shot.curveSpeed,
            shot.texture
        );
    }
}

function updateSpellcard(delta) {

    if (sideMagicAttackActive) {
        updateSideMagicAttack(delta);
        updatePendingOrbShots(delta);
        return;
    }

    waveDurationTimer += delta;
    attackTimer += delta;

    if (waveDurationTimer >= WAVE_DURATION) {

        waveDurationTimer = 0;
        attackTimer = 0;

        if (currentWave === waveFunctions.length - 1) {
            startSideMagicAttack();
            updateSideMagicAttack(delta);
            updatePendingOrbShots(delta);
            return;
        }

        currentWave++;
    }

    if (attackTimer >= waveIntervals[currentWave]) {

        attackTimer = 0;

        if (currentWave === 0 && !remiliaAttackCircle) {
            createRemiliaAttackCircle();
        }

        waveFunctions[currentWave]();
    }

    updatePendingOrbShots(delta);
}

// ==========================================
// UPDATE BULLETS
// CURVE, SCATTER AND FADE
// ==========================================

const curveAxis = new THREE.Vector3(0, 0, 1);

function getBombProjectileTarget() {
    if (!activeBomb) {
        return null;
    }

    return activeBomb.mesh
        ? activeBomb.mesh.position
        : activeBomb.effect.position;
}

function updateBullets(delta) {

    for (let i = bullets.length - 1; i >= 0; i--) {

        const bullet = bullets[i];

        bullet.age += delta;

        // Scatter red trail bullets
        if (
            bullet.type === 'trail' &&
            !bullet.scattered &&
            bullet.age >= bullet.scatterTimer
        ) {

            const randomAngle = Math.random() * Math.PI * 2;

            const randomDirection = new THREE.Vector3(
                Math.cos(randomAngle),
                Math.sin(randomAngle),
                (Math.random() - 0.5) * 0.5
            ).normalize();

            bullet.velocity.copy(
                randomDirection.multiplyScalar(
                    SMALL_BULLET_SPEED
                )
            );

            bullet.scattered = true;
        }

        if (bullet.type === 'orb' && bullet.curving) {
            bullet.velocity.applyAxisAngle(
                curveAxis,
                bullet.angularVelocity * delta
            );
        }

        bullet.mesh.position.addScaledVector(bullet.velocity, delta);

        // Purple orbs create red trails
        if (bullet.type === 'orb') {
            bullet.trailTimer += delta;

            while (bullet.trailTimer >= TRAIL_INTERVAL) {
                bullet.trailTimer -= TRAIL_INTERVAL;
                createTrail(bullet);
            }
        }

        if (bullet.type === 'trail') {

            const fadeStart =
                bullet.lifetime * TRAIL_FADE_START;

            if (bullet.age >= fadeStart) {

                const progress = THREE.MathUtils.clamp(
                    (bullet.age - fadeStart) /
                    (bullet.lifetime - fadeStart),
                    0,
                    1
                );

                bullet.mesh.material.opacity = 0.5 * (1 - progress);
            }
        } else if (bullet.type === 'orb') {
            const fadeStart = bullet.lifetime * 0.65;

            if (bullet.age >= fadeStart) {
                const progress = THREE.MathUtils.clamp(
                    (bullet.age - fadeStart) /
                    (bullet.lifetime - fadeStart),
                    0,
                    1
                );

                bullet.mesh.material.opacity = 1 - progress;
            }
        }

        // Remove expired or distant bullets
        if (
            (bullet.age >= bullet.lifetime ||
                bullet.mesh.position.distanceTo(emitterPosition) >
                    (bullet.type === 'orb'
                        ? LARGE_ORB_MAX_DISTANCE
                        : SMALL_BULLET_MAX_DISTANCE))
        ) {

            scene.remove(bullet.mesh);

            if (bullet.type === 'trail' || bullet.type === 'orb') {
                bullet.mesh.material.dispose();
            }

            bullets.splice(i, 1);
        }
    }
}

// ==========================================
// WINDOW RESIZE
// ==========================================

window.addEventListener('resize', () => {

    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    if (activeBomb?.screenWipe) {
        activeBomb.screenWipe.scale.x = camera.aspect;
        activeBomb.screenWipe.material.uniforms.uAspect.value =
            camera.aspect;
    }
});

// ==========================================
// ANIMATION LOOP
// ==========================================

const clock = new THREE.Clock();

startSpellcardAudio();
createMagicCircles();

function animate() {

    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    updateCameraControls(delta);
    updateBomb(delta);
    updatePlayerShots(delta);
    updateRemiliaAttackCircle(delta);

    cloudVolumeMaterials.forEach(({ material, volume }) => {
        material.uniforms.uTime.value += delta;
        volume.position.x = controls.target.x+100;
        volume.position.z = controls.target.z + CLOUD_LAYER_DEPTH;
        const cameraLocal = material.uniforms.uCameraLocal.value;
        cameraLocal.copy(camera.position).sub(volume.position);
        const cameraInside = cameraLocal.x > cloudBoundsMin.x &&
            cameraLocal.x < cloudBoundsMax.x &&
            cameraLocal.y > cloudBoundsMin.y &&
            cameraLocal.y < cloudBoundsMax.y &&
            cameraLocal.z > cloudBoundsMin.z &&
            cameraLocal.z < cloudBoundsMax.z;
        const cloudSide = cameraInside ? THREE.BackSide : THREE.FrontSide;

        if (material.side !== cloudSide) {
            material.side = cloudSide;
            material.needsUpdate = true;
        }
    });

    // Magic circle introduction first
    if (magicPhase !== 'finished') {

        updateMagicIntroduction(delta);

    } else {

        updateSpellcard(delta);
    }

    updateMagicProjectiles(delta);
    updateBullets(delta);

    renderer.render(scene, camera);
}

animate();
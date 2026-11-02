import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ZOOM_SPEED = 0.02;
const MIN_CAMERA_DISTANCE = 1.2;
const MAX_CAMERA_DISTANCE = 80;
const CAMERA_MOVE_SPEED = 30;
const CAMERA_BOOST_SPEED = CAMERA_MOVE_SPEED * 3;

export function createCameraControls(
    camera,
    canvas,
    initialTarget,
    onInteract,
    onShootStart,
    onShootEnd,
    onBomb
) {
    const movementKeys = {
        w: false,
        a: false,
        s: false,
        d: false,
        shift: false
    };

    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(initialTarget);
    controls.enableRotate = true;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.mouseButtons.LEFT = null;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.update();

    canvas.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    canvas.addEventListener('pointerdown', (event) => {
        if (event.button === 0) {
            onShootStart();
        }
    });
    window.addEventListener('pointerup', (event) => {
        if (event.button === 0) {
            onShootEnd();
        }
    });
    window.addEventListener('pointercancel', onShootEnd);

    window.addEventListener('keydown', (event) => {
        onInteract();

        const key = event.key.toLowerCase();
        if (key === 'x' && !event.repeat) {
            onBomb();
            event.preventDefault();
        }

        if (key in movementKeys) {
            movementKeys[key] = true;
            event.preventDefault();
        }
    });

    window.addEventListener('pointerdown', onInteract);

    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        if (key in movementKeys) {
            movementKeys[key] = false;
            event.preventDefault();
        }
    });

    window.addEventListener('blur', () => {
        Object.keys(movementKeys).forEach((key) => {
            movementKeys[key] = false;
        });
        onShootEnd();
    });

    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();

        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(
            offset.length() + event.deltaY * ZOOM_SPEED,
            MIN_CAMERA_DISTANCE,
            MAX_CAMERA_DISTANCE
        );

        camera.position.copy(
            controls.target.clone().add(offset.setLength(distance))
        );
        controls.update();
    }, { passive: false });

    function updateCameraControls(delta) {
        controls.update();
        camera.updateMatrixWorld();

        const horizontalInput =
            Number(movementKeys.d) - Number(movementKeys.a);
        const verticalInput =
            Number(movementKeys.w) - Number(movementKeys.s);

        if (horizontalInput !== 0 || verticalInput !== 0) {
            const right = new THREE.Vector3()
                .setFromMatrixColumn(camera.matrixWorld, 0);
            const up = new THREE.Vector3()
                .setFromMatrixColumn(camera.matrixWorld, 1);
            const movement = right.multiplyScalar(horizontalInput)
                .addScaledVector(up, verticalInput);
            movement.normalize();

            const speed = movementKeys.shift
                ? CAMERA_BOOST_SPEED
                : CAMERA_MOVE_SPEED;
            const offset = movement.multiplyScalar(speed * delta);
            camera.position.add(offset);
            controls.target.add(offset);
        }

        controls.update();
    }

    return { controls, updateCameraControls };
}

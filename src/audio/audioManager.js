const scarletStartSound = new Audio(
    'assets/audio/touhou-spellcard-warning-sfx.mp3'
);
scarletStartSound.volume = 0.5;
let scarletStartSoundPending = false;

const knifeShotSound = new Audio('assets/audio/tan01.wav');
knifeShotSound.preload = 'auto';
const laserShotSound = new Audio('assets/audio/lazer00.wav');
laserShotSound.preload = 'auto';
const summoningTheme = new Audio('assets/audio/SWR Remilia Theme.mp3');
summoningTheme.volume = 0.5;
summoningTheme.loop = true;
let summoningThemePending = false;
let summoningThemePlayed = false;

function playSummoningTheme() {
    if (!summoningThemePending || summoningThemePlayed) {
        return;
    }

    summoningThemePending = false;
    summoningTheme.play().then(() => {
        summoningThemePlayed = true;
    }).catch((error) => {
        if (error.name === 'NotAllowedError') {
            summoningThemePending = true;
            return;
        }

        console.error('Could not play Remilia theme:', error);
    });
}

export function playKnifeShotSound() {
    if (!knifeShotSound.paused && !knifeShotSound.ended) {
        return;
    }

    knifeShotSound.currentTime = 0;
    knifeShotSound.volume = 0.2;
    knifeShotSound.playbackRate = 0.9 + Math.random() * 0.2;
    knifeShotSound.play().catch((error) => {
        console.error('Could not play knife shot sound:', error);
    });
}

export function playLaserShotSound() {
    if (!laserShotSound.paused && !laserShotSound.ended) {
        return;
    }

    laserShotSound.currentTime = 0;
    laserShotSound.volume = 0.35;
    laserShotSound.play().catch((error) => {
        console.error('Could not play laser shot sound:', error);
    });
}

function playScarletStartSound() {
    if (!scarletStartSoundPending) {
        return;
    }

    scarletStartSoundPending = false;
    scarletStartSound.currentTime = 0;
    scarletStartSound.play().catch((error) => {
        if (error.name === 'NotAllowedError') {
            scarletStartSoundPending = true;
            return;
        }

        console.error('Could not play Scarlet Gensokyo sound:', error);
    });
}

export function requestScarletStartSound() {
    scarletStartSoundPending = true;
    playScarletStartSound();
}

export function activateAudio() {
    playScarletStartSound();
    playSummoningTheme();
}

export function startSpellcardAudio() {
    summoningThemePending = true;
    playSummoningTheme();
    requestScarletStartSound();
}

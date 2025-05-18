// Celestial background
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with static background
    createStaticStars();
    initStaticNebula();
});

// Global variables to track state and intervals
let shootingStarInterval = null;
let mousemoveHandler = null;

// Function to clear all background elements and event listeners
function clearBackground() {
    // Clear stars
    const starsContainer = document.getElementById('stars');
    while (starsContainer.firstChild) {
        starsContainer.removeChild(starsContainer.firstChild);
    }
    
    // Clear nebula
    const nebula = document.getElementById('nebula');
    while (nebula.firstChild) {
        nebula.removeChild(nebula.firstChild);
    }
    
    // Clear nebula animation
    nebula.style.animation = 'none';
    
    // Clear shooting star interval
    if (shootingStarInterval) {
        clearInterval(shootingStarInterval);
        shootingStarInterval = null;
    }
    
    // Remove mousemove event listener
    if (mousemoveHandler) {
        document.removeEventListener('mousemove', mousemoveHandler);
        mousemoveHandler = null;
    }
    
    // Remove any added styles
    const addedStyles = document.querySelectorAll('style[data-celestial]');
    addedStyles.forEach(style => style.remove());
}

function createStaticStars() {
    const starsContainer = document.getElementById('stars');
    const starCount = 300;
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        // Random position
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        
        // Random size
        const size = Math.random() * 4;
        
        // Random color (slight variation)
        const hue = Math.random() * 60 - 30; // -30 to +30
        const color = `hsl(${hue + 220}, 100%, 100%)`; // Blue-ish white
        
        // Apply styles - no animations
        star.style.cssText = `
            position: absolute;
            top: ${y}%;
            left: ${x}%;
            width: ${size}px;
            height: ${size}px;
            background-color: ${color};
            border-radius: 50%;
            box-shadow: 0 0 ${size * 3}px rgba(255, 255, 255, 0.8);
            opacity: 0.8;
            z-index: 1;
        `;
        
        starsContainer.appendChild(star);
    }
}

function initStaticNebula() {
    const nebula = document.getElementById('nebula');
    
    // Remove animation
    nebula.style.animation = 'none';
    
    // Create additional nebula layers for depth
    const nebulaLayers = 3;
    for (let i = 0; i < nebulaLayers; i++) {
        const layer = document.createElement('div');
        layer.className = 'nebula-layer';
        
        // Different colors for each layer
        const colors = [
            'rgba(108, 99, 255, 0.2)',
            'rgba(74, 144, 226, 0.15)',
            'rgba(255, 107, 107, 0.1)'
        ];
        
        layer.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: ${100 + i * 20}%;
            height: ${100 + i * 20}%;
            background: radial-gradient(circle at center, 
                ${colors[i]} 0%,
                transparent 70%);
            filter: blur(${40 + i * 10}px);
            z-index: -${i + 1};
        `;
        
        nebula.appendChild(layer);
    }
} 
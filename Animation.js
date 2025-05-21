// Animation.js
// Fait par Copilot

// Animation : Fade-in sur le body au chargement
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = 0;
    document.body.style.transition = 'opacity 1.2s';
    setTimeout(() => {
        document.body.style.opacity = 1;
    }, 100);
});

// Animation : Survol des liens (a) - effet de soulignement animé
const style = document.createElement('style');
style.textContent = `
    a {
        position: relative;
        color: inherit;
        text-decoration: none;
        transition: color 0.3s;
    }
    a::after {
        content: '';
        position: absolute;
        left: 0; bottom: -2px;
        width: 100%;
        height: 2px;
        background:rgb(0, 0, 0);
        transform: scaleX(0);
        transition: transform 0.3s;
        transform-origin: left;
    }
    a:hover::after {
        transform: scaleX(1);
    }
    a:hover {
        color:rgb(254, 0, 144);
    }
`;
document.head.appendChild(style);

// Animation : Boutons qui grossissent au survol
document.addEventListener('DOMContentLoaded', () => {
    const btnStyle = document.createElement('style');
    btnStyle.textContent = `
        button {
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: scale(1.07);
            box-shadow: 0 4px 16px rgba(52,152,219,0.15);
        }
    `;
    document.head.appendChild(btnStyle);
});
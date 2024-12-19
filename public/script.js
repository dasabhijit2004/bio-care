const backToTop = document.getElementById('backToTop');
const navMenu = document.querySelector('nav ul');
const navToggle = document.querySelector('.toggle');

// Back to Top Button Functionality
window.addEventListener('scroll', () => {
    backToTop.style.display = window.scrollY > 200 ? 'block' : 'none';
});

backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Style navToggle Button
navToggle.style.color = '#1717a6';
navToggle.style.background = 'transparent';
navToggle.style.border = 'none';
navToggle.style.cursor = 'pointer';
navToggle.style.fontSize = '20px';

// Toggle the Menu
let flag = 0;
navToggle.addEventListener('click', () => {
    if (flag == 0) {
        navMenu.classList.add('show');
        navToggle.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        flag = 1;
    }
    else {
        navMenu.classList.remove('show');
        navToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        flag = 0;
    }
});


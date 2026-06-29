(function(){
  const body = document.body;
  const button = document.querySelector('.hamb');
  const menu = document.querySelector('.menu');
  if(button && menu){
    button.type = 'button';
    button.setAttribute('aria-label', 'Ouvrir le menu');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const open = body.classList.toggle('ps-mobile-nav-open');
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? '×' : '☰';
    });
    menu.addEventListener('click', event => {
      if(event.target.closest('a')){
        body.classList.remove('ps-mobile-nav-open');
        button.setAttribute('aria-expanded', 'false');
        button.textContent = '☰';
      }
    });
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape'){
        body.classList.remove('ps-mobile-nav-open');
        button.setAttribute('aria-expanded', 'false');
        button.textContent = '☰';
      }
    });
  }

  document.querySelectorAll('img:not([loading])').forEach(img => {
    img.loading = img.closest('header') ? 'eager' : 'lazy';
    img.decoding = 'async';
  });
})();

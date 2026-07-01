document.addEventListener('DOMContentLoaded', () => {
  const validHostnames = [
    'personal.okta1.com',
    'personal.trexcloud.com',
    'personal.okta.com'
  ];
  const queryParams = new URLSearchParams(window.location.search);
  let hostname = queryParams.get('hostname') || '';

  if (!validHostnames.some(validHostname => validHostname === hostname)) {
    hostname = 'personal.okta.com';
  }
  document.querySelector('a#hostname').href = `https://${hostname}`;
});

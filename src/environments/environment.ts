export const environment = {
  production: false,
  // En dev, on appelle directement le backend (plus de proxy Angular)
  apiUrl: 'http://192.168.2.129:8095/api/evolution',
  apiUrlWithSlash: 'http://192.168.2.129:8095/api/evolution/',
  rolePermissionUrl: 'http://192.168.2.129:8095/api/evolution/rolepermission'
};

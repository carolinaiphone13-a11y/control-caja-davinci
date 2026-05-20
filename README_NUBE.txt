SISTEMA CONTROL DE CAJA DA VINCI - USO EN NUBE MULTIUSUARIO

Objetivo:
- Usar el sistema desde una URL HTTPS, sin instalar nada en los computadores.
- Permitir que varios usuarios vean y actualicen la misma informacion.
- Mantener respaldo local automatico en cada navegador si la conexion falla.

Pasos recomendados con Firebase:
1. Crear un proyecto en https://console.firebase.google.com
2. Activar Authentication > Sign-in method > Anonymous.
3. Crear Firestore Database en modo produccion.
4. En Project settings > Web app, copiar las credenciales Firebase.
5. Pegar esas credenciales en firebase-config.js.
6. Publicar esta carpeta en Firebase Hosting.

Comandos de despliegue, si se usa Firebase CLI:
1. firebase login
2. firebase init hosting firestore
3. firebase deploy

Reglas incluidas:
- firestore.rules permite leer y escribir solo a sesiones autenticadas.
- La app usa inicio anonimo automatico para evitar cuentas por usuario.

Notas operativas:
- Todos los datos se guardan en el documento Firestore davinci/control-caja.
- Si dos usuarios editan al mismo tiempo, se conserva el ultimo guardado recibido.
- Para mayor control futuro se recomienda agregar usuarios con correo, roles y auditoria por folio.

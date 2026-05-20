SISTEMA CONTROL DE CAJA DA VINCI - VERSIÓN FINAL

1. Abrir index.html en Google Chrome o Microsoft Edge.
2. Para instalar en PC: abrir menú del navegador > Instalar app.
3. Para Android/iPhone: abrir en navegador y usar "Agregar a pantalla de inicio".
4. La app móvil queda orientada a visualización de movimientos y reportes.
5. Para usar desde nube sin instalacion y sincronizar varios usuarios:
   - Crear proyecto Google Firebase con Firestore.
   - Activar Authentication > Anonymous.
   - Copiar credenciales en firebase-config.js.
   - Subir esta carpeta a Firebase Hosting o a un hosting HTTPS.
   - Al usar la misma URL en los 3 computadores, la información quedará centralizada.
6. Mientras no se configure Firebase, el sistema opera en modo local del computador.
7. Ver README_NUBE.txt para pasos de despliegue y reglas Firestore.

Módulos incluidos:
- Registro diario Caja N°1 y Caja N°2
- Movimientos Caja N°1 y Caja N°2
- Devolución a pacientes con folio automático
- Salidas de dinero con folio automático
- Centralización mensual de devoluciones
- Centralización mensual de salidas de dinero
- Cierre de caja mensual centralizado
- Centralización mensual de profesionales, solo con profesionales con ingresos
- Nómina profesionales con agregar, modificar, eliminar, descargar PDF e imprimir
- Configuración, respaldo e importación

# Finanzas — seguimiento mensual

App de seguimiento de ingresos, gastos y facturas, con dashboard y gráficos.
Guarda los datos en Firebase Firestore, así que se sincronizan entre dispositivos
(igual que Caja Barbería / Laton Studio App).

## 1. Crear el proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → **Añadir proyecto** (puedes llamarlo `finanzas-paula` o lo que prefieras).
2. Dentro del proyecto, ve a **Compilación → Firestore Database → Crear base de datos**. Elige modo **producción** y la región más cercana (ej. `eur3`).
3. Ve a **Compilación → Authentication → Sign-in method** y activa **Anónimo**. Esto permite que la app se conecte sin pedirte usuario/contraseña, pero sigue exigiendo autenticación para poder leer/escribir.
4. Ve a **Configuración del proyecto** (icono ⚙️) → baja hasta **Tus apps** → pulsa el icono `</>` (Web) → dale un nombre (ej. `finanzas-web`) → **Registrar app**. No hace falta que sigas los pasos de instalar el SDK con npm, esta app ya usa Firebase directamente desde CDN.
5. Copia el objeto `firebaseConfig` que te muestra y pégalo en el archivo `firebase-config.js` de este proyecto, sustituyendo los valores de ejemplo.

## 2. Reglas de seguridad de Firestore

Ve a **Firestore Database → Reglas** y pega esto (solo permite acceso a usuarios autenticados, incluido el anónimo):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /meses/{mesId} {
      allow read, write: if request.auth != null;
    }
    match /config/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Publica los cambios.

## 3. Subir a GitHub

```bash
cd finanzas-app
git init
git add .
git commit -m "Primera versión de la app de finanzas"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/finanzas-app.git
git push -u origin main
```

## 4. Activar GitHub Pages

1. En el repo de GitHub, ve a **Settings → Pages**.
2. En **Source**, elige la rama `main` y la carpeta `/ (root)`.
3. Guarda. En un par de minutos tu app estará disponible en:
   `https://TU_USUARIO.github.io/finanzas-app/`

## Cómo funciona

- **⚙️ Configuración**: gestiona las categorías que aparecen en el desplegable "Categoría" de la tabla de Gastos (añadir/eliminar). Se guardan en Firestore y se comparten entre todos los meses.
- **Dashboard**: resumen de todos los meses, con gráfico de barras (ingresos vs gastos) y de líneas (evolución del beneficio neto).
- **Cada mes** (pestaña en la barra lateral): resumen con saldo inicial/reserva editables, y tres tablas — Ingresos, Gastos (con estado Pagado/Pendiente) y Facturas emitidas — donde puedes añadir, editar o borrar filas directamente.
- **+ Nuevo mes**: crea una pestaña nueva heredando el saldo total del mes anterior como saldo inicial.
- Todo se guarda automáticamente en Firestore al cambiar cualquier campo (evento `change`, no en cada tecla).
- La primera vez que abras la app, si no hay ningún mes en Firestore, se crea automáticamente uno de ejemplo con los datos de Julio 2026 que ya tenías.

## Estructura de archivos

```
finanzas-app/
├── index.html          # estructura de la página
├── style.css           # estilos
├── app.js              # lógica de la app (Firebase + render)
├── firebase-config.js  # tu configuración de Firebase (no la compartas públicamente si el repo es público)
└── README.md
```

## Nota sobre el repositorio público

Si tu repositorio de GitHub es público, cualquiera podrá ver el contenido de
`firebase-config.js` (no es un secreto grave: la seguridad real la dan las
reglas de Firestore del paso 2, no ocultar esta configuración). Aun así, si
prefieres más privacidad, puedes crear el repositorio como **privado** y
activar GitHub Pages igualmente (disponible en el plan gratuito para
repositorios privados de cuentas personales).

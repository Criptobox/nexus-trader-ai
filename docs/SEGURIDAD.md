# 🔐 Seguridad — NEXUS Trader AI

## Modelo de amenazas (resumen)

| Amenaza | Mitigación en NEXUS |
|---|---|
| Clave API filtrada en el repo | Las claves nunca viven en código: se guardan cifradas en la base de datos y la master secret va en `.env` (gitignoreado) |
| Robo del archivo de base de datos | Las claves están cifradas con AES-256-GCM; sin `NEXUS_MASTER_SECRET` el archivo es inútil |
| Exposición de claves por la API | Ningún endpoint devuelve la clave completa — solo la máscara `AbC4••••••••Xy9z` |
| Clave con permiso de retiro | Rechazada server-side por política (`scope=withdraw` → 422) |
| Agente desbocado | Risk Engine (4 capas) + Kill Switch manual irreversible |
| FOMO/emociones del operador | Decisiones por comité + límites automáticos + memoria de consecuencias |

## Detalle de la criptografía

1. **Derivación**: `scrypt(master_secret, salt_aleatorio_16B, N=16384, r=8, p=1)` → clave de 32 bytes por registro.
2. **Cifrado**: AES-256-GCM con IV aleatorio de 12 bytes por operación; el `authTag` (16 B) se almacena junto al ciphertext — cualquier manipulación del registro invalida el descifrado.
3. **Almacenamiento**: `cipherText = salt ‖ ciphertext` en hex + `iv` + `authTag` en columnas separadas de la tabla `VaultKey`.
4. **Rotación**: borra la clave en Ajustes y crea una nueva en el exchange; los registros cifrados antiguos se eliminan en cascada.

## Checklist antes de subir a GitHub

- [ ] `.env` está en `.gitignore` (ya configurado) y `NEXUS_MASTER_SECRET` NO está en el código.
- [ ] `db/custom.db` no contiene claves reales (borra el archivo antes del primer push si hiciste pruebas con claves verdaderas).
- [ ] No hay `console.log` con secretos en el código.
- [ ] El README mantiene el aviso legal.

## Checklist al crear claves de exchange

1. **Solo lectura** para analizar la cuenta (suficiente para el 95% de casos).
2. Permiso de **trading** solo en Fase 4 del roadmap y solo si tu servidor tiene IP fija + restricción IP activada.
3. **Retiros: NUNCA.** NEXUS lo bloquea igualmente.
4. Rota cada 90 días o inmediatamente ante cualquier sospecha.

## Buenas prácticas de despliegue

- Ejecuta detrás de HTTPS (Caddy/Nginx + Let's Encrypt).
- `NEXUS_MASTER_SECRET`: 32+ bytes aleatorios (`openssl rand -hex 32`), diferente por entorno.
- Backup del `.db`: cifrado también (contiene decisiones y memoria, no claves en claro).
- Mantén el Kill Switch accesible desde el móvil: es tu botón rojo de pánico.

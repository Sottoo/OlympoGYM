; ─────────────────────────────────────────────────────────────────────────
; Personalización del instalador de Olimpo GYM (electron-builder lo incluye
; solo; ver "nsis" en package.json).
;
;   · Instalar: página de bienvenida con el logo y textos propios al final.
;   · Desinstalar: una página para elegir si también se borran los datos del
;     gimnasio. Por omisión NO se borran, así que reinstalar o actualizar
;     nunca pierde información. Los respaldos de Documentos nunca se tocan.
;
; Este archivo entra antes que MUI2, así que todo lo que usa sus macros va
; dentro de los macros custom*, que electron-builder expande más adelante.
; ─────────────────────────────────────────────────────────────────────────

!ifndef BUILD_UNINSTALLER

  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Bienvenido a ${PRODUCT_NAME}"
    !define MUI_WELCOMEPAGE_TEXT "Este asistente instalará el sistema de administración de ${PRODUCT_NAME} (versión ${VERSION}) en esta computadora.$\r$\n$\r$\nSi ya está instalado, se actualizará sin tocar la información del gimnasio: socios, membresías, pagos, ventas, inventario y respaldos.$\r$\n$\r$\nCierra ${PRODUCT_NAME} antes de continuar."
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  !define MUI_FINISHPAGE_TITLE "${PRODUCT_NAME} está listo"
  !define MUI_FINISHPAGE_TEXT "La instalación terminó.$\r$\n$\r$\nLa información se guarda en esta computadora y cada día se hace un respaldo automático en Documentos\${PRODUCT_NAME}\Respaldos."

!else

  !include nsDialogs.nsh

  Var casillaBorrarDatos
  Var borrarDatos

  !macro customUnWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Desinstalar ${PRODUCT_NAME}"
    !define MUI_WELCOMEPAGE_TEXT "Este asistente quitará ${PRODUCT_NAME} de esta computadora.$\r$\n$\r$\nEn el siguiente paso puedes elegir si la información del gimnasio se conserva (lo normal) o se borra.$\r$\n$\r$\nCierra ${PRODUCT_NAME} antes de continuar."
    !insertmacro MUI_UNPAGE_WELCOME
    UninstPage custom un.paginaDatos un.salirDePaginaDatos

    Function un.paginaDatos
      ; Al actualizar (instalar una versión encima de otra) no se pregunta nada.
      ${if} ${isUpdated}
        Abort
      ${endif}
      !insertmacro MUI_HEADER_TEXT "Información del gimnasio" "Elige qué pasa con los datos guardados en esta computadora."

      nsDialogs::Create 1018
      Pop $0
      ${NSD_CreateLabel} 0 0 100% 34u "Normalmente la información se conserva: si vuelves a instalar ${PRODUCT_NAME}, todo sigue como estaba (socios, membresías, pagos, ventas, inventario, fotos y cuentas)."
      Pop $0
      ${NSD_CreateCheckbox} 0 42u 100% 12u "&Borrar también toda la información del gimnasio"
      Pop $casillaBorrarDatos
      ${if} $borrarDatos == ${BST_CHECKED}
        ${NSD_Check} $casillaBorrarDatos
      ${endif}
      ${NSD_CreateLabel} 12u 58u -12u 44u "Úsalo solo para dejar la computadora limpia o empezar desde cero. No se puede deshacer.$\r$\n$\r$\nLos respaldos de Documentos\${PRODUCT_NAME}\Respaldos no se borran: con ellos puedes recuperar la información."
      Pop $0
      nsDialogs::Show
    FunctionEnd

    Function un.salirDePaginaDatos
      ${NSD_GetState} $casillaBorrarDatos $borrarDatos
      ${if} $borrarDatos == ${BST_CHECKED}
        MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "Se borrará para siempre toda la información del gimnasio de esta computadora.$\r$\n$\r$\nLos respaldos de Documentos se conservan.$\r$\n$\r$\n¿Seguro que quieres borrarla?" /SD IDNO IDYES confirmado
        Abort
        confirmado:
      ${endif}
    FunctionEnd
  !macroend

  !macro customUnInstall
    ${ifNot} ${isUpdated}
      ; Copia del instalador que electron-builder guarda para actualizaciones
      ; automáticas; este programa no las usa.
      !ifdef APP_INSTALLER_STORE_FILE
        Delete "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
        ${StdUtils.GetParentPath} $R0 "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
        RMDir $R0
      !endif

      ${if} $borrarDatos == ${BST_CHECKED}
        DetailPrint "Borrando la información del gimnasio…"
        ; Base de datos, fotos, sesión y registro del programa (la carpeta de
        ; Electron, app.getPath("userData")).
        SetShellVarContext current
        RMDir /r "$APPDATA\${PRODUCT_NAME}"
        ${if} $installMode == "all"
          SetShellVarContext all
        ${endif}
      ${endif}
    ${endif}
  !macroend

!endif

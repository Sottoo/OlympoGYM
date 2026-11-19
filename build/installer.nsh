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

  !include FileFunc.nsh

  ; Una línea en %APPDATA%\Olimpo GYM\actualizaciones.log, la misma bitácora
  ; del actualizador del programa: así se sabe cuándo empezó y terminó cada
  ; instalación automática y cuánto tardó.
  !macro anotarActualizacion texto
    Push $0
    Push $1
    Push $2
    Push $3
    Push $4
    Push $5
    Push $6
    Push $7
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    SetShellVarContext current
    CreateDirectory "$APPDATA\${PRODUCT_NAME}"
    ClearErrors
    FileOpen $7 "$APPDATA\${PRODUCT_NAME}\actualizaciones.log" a
    ${ifNot} ${Errors}
      FileSeek $7 0 END
      FileWrite $7 "$2-$1-$0 $4:$5:$6 (hora local) [instalador] ${texto}$\r$\n"
      FileClose $7
    ${endIf}
    ${if} $installMode == "all"
      SetShellVarContext all
    ${endIf}
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  !macroend

  ; ── Actualización automática ─────────────────────────────────────────
  ; El programa corre este instalador con --updated: se ve SOLO la página de
  ; progreso (barra y detalle) y al terminar se abre el programa. Las demás
  ; páginas se saltan solas. Instalar a mano sigue igual, con todas sus páginas.
  ; Las versiones anteriores a la 1.0.0-beta.30 lo corren en silencio (/S):
  ; para ellas se muestra al menos un aviso fijo mientras se instala.
  !macro customInit
    ${if} ${isUpdated}
      !insertmacro anotarActualizacion "Empezó a instalar la versión ${VERSION}."
      ${if} ${Silent}
        Banner::show /set 76 "Actualizando ${PRODUCT_NAME} a la versión ${VERSION}…" "No lo abras: se abrirá solo al terminar. Puede tardar unos minutos."
      ${endIf}
    ${endIf}
  !macroend

  !macro customInstall
    ${if} ${isUpdated}
      !insertmacro anotarActualizacion "Terminó de instalar la versión ${VERSION}."
      ${if} ${Silent}
        Banner::destroy
      ${endIf}
    ${endIf}
  !macroend

  ; Al actualizar no se pregunta para quién instalar: se usa la misma forma que ya tenía.
  !macro customInstallMode
    ${if} ${isUpdated}
      ${if} $hasPerMachineInstallation == "1"
        StrCpy $isForceMachineInstall "1"
      ${else}
        StrCpy $isForceCurrentInstall "1"
      ${endIf}
    ${endIf}
  !macroend

  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Bienvenido a ${PRODUCT_NAME}"
    !define MUI_WELCOMEPAGE_TEXT "Este asistente instalará el sistema de administración de ${PRODUCT_NAME} (versión ${VERSION}) en esta computadora.$\r$\n$\r$\nSi ya está instalado, se actualizará sin tocar la información del gimnasio: socios, membresías, pagos, ventas, inventario y respaldos.$\r$\n$\r$\nCierra ${PRODUCT_NAME} antes de continuar."
    !insertmacro skipPageIfUpdated
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; La página de progreso dice que es una actualización y que no hay que tocar nada.
  !macro customPageAfterChangeDir
    Function textoDeActualizacion
      ${if} ${isUpdated}
        !insertmacro MUI_HEADER_TEXT "Actualizando ${PRODUCT_NAME} a la versión ${VERSION}" "No apagues la computadora. El programa se abrirá solo al terminar."
      ${endIf}
    FunctionEnd
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW textoDeActualizacion
  !macroend

  ; Página final: al instalar a mano, con la casilla de abrir el programa. Al
  ; actualizar no se muestra: si se pidió (--force-run), se abre el programa y listo.
  !macro customFinishPage
    ; --desde-instalador: el programa sabe que lo abre el instalador al terminar. Sin esto,
    ; al ver el instalador todavía cerrándose creía que había una instalación a medias y no abría.
    Function abrirOlimpo
      ${if} ${isUpdated}
        ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated --desde-instalador"
      ${else}
        ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--desde-instalador"
      ${endIf}
    FunctionEnd

    Function saltarFinalSiActualiza
      ${if} ${isUpdated}
        ${if} ${isForceRun}
          Call abrirOlimpo
        ${endIf}
        Abort
      ${endIf}
    FunctionEnd

    !define MUI_PAGE_CUSTOMFUNCTION_PRE saltarFinalSiActualiza
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "abrirOlimpo"
    !insertmacro MUI_PAGE_FINISH
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

# Exclusiones de Windows Defender para acelerar el lint, el tipado y los tests.
#
# IMPORTANTE: este script lo ejecuta una persona con permisos de administrador.
# El agente de IA no debe ejecutarlo ni consultar las exclusiones
# (Historias.md 15.26; constitución, «Flujo de desarrollo»).
#
# Uso (PowerShell como administrador):
#   .\scripts\windows-defender-exclusions.ps1           # añade las exclusiones
#   .\scripts\windows-defender-exclusions.ps1 -Remove   # las quita

#Requires -RunAsAdministrator

param(
	[switch]$Remove
)

$projectPath = Split-Path -Parent $PSScriptRoot
$paths = @(
	$projectPath,
	(Join-Path $env:LOCALAPPDATA 'pnpm\store'),
	(Join-Path $env:LOCALAPPDATA 'pnpm-cache')
)

foreach ($path in $paths) {
	if ($Remove) {
		Remove-MpPreference -ExclusionPath $path
		Write-Output "Exclusión eliminada: $path"
	} else {
		Add-MpPreference -ExclusionPath $path
		Write-Output "Exclusión añadida: $path"
	}
}

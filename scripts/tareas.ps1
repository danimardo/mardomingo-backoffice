# Lista las tareas pendientes de specs/001-cuenta-mardomingo-v4/tasks.md en una sola línea, separadas por comas.
# Pendiente = casilla sin marcar [ ], o marcada [x] con una nota de «Parcial», «Pendiente» o «Falta», salvo que la misma línea diga
# «Completado». Solo lee el fichero: no modifica nada.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\tareas.ps1

$root = Split-Path -Parent $PSScriptRoot
$tasksPath = Join-Path $root 'specs\001-cuenta-mardomingo-v4\tasks.md'

if (-not (Test-Path -LiteralPath $tasksPath)) {
	Write-Error "No se encuentra el fichero de tareas: $tasksPath"
	exit 1
}

$pending = @()
foreach ($line in Get-Content -LiteralPath $tasksPath -Encoding UTF8) {
	if ($line -notmatch '^- \[( |x|X)\] (T\d+)\b') { continue }
	$checked = $Matches[1] -ne ' '
	$id = $Matches[2]
	$isPending = $false
	if (-not $checked) {
		$isPending = $true
	} elseif (($line -match 'Parcial|Pendiente|Falta') -and ($line -notmatch 'Completado')) {
		$isPending = $true
	}
	if ($isPending) { $pending += $id }
}

Write-Output ($pending -join ', ')

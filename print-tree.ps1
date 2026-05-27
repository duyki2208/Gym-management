function Show-Tree {
    param(
        [string]$path,
        [string]$indent = ""
    )

    $items = Get-ChildItem -Path $path -Force | Where-Object { $_.Name -notmatch '^(node_modules|.git|.vs|dist|build)$' }
    $count = $items.Count

    for ($i = 0; $i -lt $count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $count - 1)
        
        $prefix = if ($isLast) { "└── " } else { "├── " }
        Write-Output ("$indent$prefix" + $item.Name)
        
        if ($item.PSIsContainer) {
            $newIndent = $indent + if ($isLast) { "    " } else { "│   " }
            Show-Tree -path $item.FullName -indent $newIndent
        }
    }
}
Write-Output "do-an-tot-nghiep"
Show-Tree -path "d:\do-an-tot-nghiep"

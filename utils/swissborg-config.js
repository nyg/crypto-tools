export const colors = [
   '#A3B8C7', '#A7C7E7', '#B0A6D3', '#D6B94D', '#B7826E', '#8C9D8B',
   '#A0B15D', '#8BACC4', '#9F8C85', '#A7B7C3', '#9E8D89', '#7DB3E0',
   '#A8A9E2'
]

export const colorFor = index => colors[index % colors.length]

export const multiplierFor = {
   genesis: 1,
   pioneer: .875,
   community: .75,
   explorer: .625,
   standard: .5
}

export const defaultVisibleAssets = new Set([
   'ADA (Kiln)',
   'ATOM (Kiln)',
   'AVAX (GoGoPool)',
   'SOL (Kyros)',
])

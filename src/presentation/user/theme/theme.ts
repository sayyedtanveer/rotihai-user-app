// Brand colors and typography adapted from the RotiHai web Warm Roti theme.
export const theme = {
 bg:'#fff8ef',surface:'#ffffff',ink:'#30251f',muted:'#75665c',primary:'#a85a17',
 pale:'#fff3e2',border:'#eee7df',inputBorder:'#9e8b7b',onPrimary:'#ffffff',danger:'#b63c34',accent:'#f97316',gold:'#fbbf24',success:'#20724d',
 font:'Inter_400Regular',medium:'Inter_500Medium',semibold:'Inter_600SemiBold',bold:'Inter_700Bold',display:'Inter_800ExtraBold',
};

// Same color keys exposed by web AdminPromotionalBanners.
const promotionalColors:Record<string,string>={'orange-600':'#ea580c','amber-600':'#b45309','yellow-600':'#ca8a04','red-600':'#dc2626','rose-600':'#e11d48','pink-600':'#db2777','blue-600':'#2563eb','cyan-600':'#0891b2','teal-600':'#0d9488','purple-600':'#9333ea','violet-600':'#7c3aed','indigo-600':'#4f46e5','green-600':'#16a34a','emerald-600':'#059669'};
export const bannerColor=(key?:string)=>key&&promotionalColors[key]||promotionalColors['orange-600'];

export const typography={screenTitle:{fontFamily:theme.display,fontSize:26,lineHeight:33,letterSpacing:-.8},sectionTitle:{fontFamily:theme.bold,fontSize:18,lineHeight:25,letterSpacing:-.35},kitchenName:{fontFamily:theme.bold,fontSize:18,lineHeight:24},productName:{fontFamily:theme.bold,fontSize:16,lineHeight:22},price:{fontFamily:theme.semibold,fontSize:15,lineHeight:22},body:{fontFamily:theme.font,fontSize:14,lineHeight:22},button:{fontFamily:theme.bold,fontSize:14},label:{fontFamily:theme.semibold,fontSize:12},caption:{fontFamily:theme.font,fontSize:11,lineHeight:17}};

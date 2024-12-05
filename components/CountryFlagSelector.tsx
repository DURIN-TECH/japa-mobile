import { useState } from "react"
import { TextInput } from "react-native-gesture-handler";
import { Search } from "lucide-react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { ScrollView, View, Image } from "react-native";

// Sample country data
const supportedCountries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
]

const upcomingCountries = [
  { code: 'ES', name: 'Spain' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'RU', name: 'Russia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AR', name: 'Argentina' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
]

export default function CountryFlagSelector() {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredCountries = supportedCountries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <View>
      <View className="p-4 bg-transparent">
        <View className="relative">
          <TextInput
            placeholder="Search countries"
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="pl-10 pr-4 py-2 rounded-full border border-gray-200"
          />
          <Search className="absolute left-3 top-2.5" size={20} color="#9CA3AF" />
        </View>
      </View>

      <ThemedText className="ml-4 font-extrabold">Select Your Preferred Country</ThemedText>
      
      <ScrollView contentContainerClassName="p-1">
        <View>
          <View>
            <ThemedText className="ml-5 my-5">Supported Country</ThemedText>
            <View className="flex-row flex-wrap gap-4 justify-evenly">
              {filteredCountries.map((country) => (
                <View key={country.code} className="items-center w-[15%]">
                  <View className="w-10 h-10 rounded-lg overflow-hidden mb-2">
                    <Image
                      source={{ uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png` }}
                      className="w-full h-full"
                    />
                  </View>
                  <ThemedText className="text-center text-sm">{country.name}</ThemedText>
                </View>
              ))}
            </View>
          </View>
          <View>
            <ThemedText className="ml-5 my-5">Coming Soon</ThemedText>
            <View className="flex-row flex-wrap gap-4 justify-evenly">
              {upcomingCountries.map((country) => (
                <View key={country.code} className="items-center w-[15%]">
                  <View className="w-10 h-10 rounded-lg overflow-hidden mb-2">
                    <Image
                      source={{ uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png` }}
                      className="w-full h-full"
                    />
                  </View>
                  <ThemedText className="text-center text-sm">{country.name}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// export default function CountryFlagSelector() {
//   const [searchTerm, setSearchTerm] = useState('')
//   const filteredCountries = countries.filter(country =>
//     country.name.toLowerCase().includes(searchTerm.toLowerCase())
//   )

//   return (
//     <ThemedView className="flex-1 mx-auto bg-background p-4 rounded-lg shadow-lg">
//       <ThemedView className="relative mb-4 bg-red-700">
//         <TextInput
//           placeholder="Search countries"
//           value={searchTerm}
//           onChangeText={setSearchTerm}
//           className="pl-10 pr-4 py-2 w-full rounded-full border-gray-300 focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
//         />
//         <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
//       </ThemedView>
//       <ScrollView>
//         <ThemedView className="grid grid-cols-3 gap-4">
//           {filteredCountries.map((country) => (
//             <ThemedView key={country.code} className="flex flex-col items-center">
//               <ThemedView className="w-5 h-5 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 mb-2">
//                 <Image
//                   src={`https://flagcdn.com/w160/${country.code.toLowerCase()}.png`}
//                   alt={`${country.name} flag`}
//                   className="w-full h-full object-cover"
//                 />
//               </ThemedView>
//               <ThemedText className="text-sm text-center font-medium text-gray-700">{country.name}</ThemedText>
//             </ThemedView>
//           ))}
//         </ThemedView>
//       </ScrollView>
//     </ThemedView>
//   )
// }


// export default function CountryFlagSelector() {
//   const [searchTerm, setSearchTerm] = useState("");
//   const filteredCountries = countries.filter(country =>
//     country.name.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   return (
//     <ThemedView style={{ flex: 1 }}>
//       <ThemedView style={{ padding: 16, backgroundColor: "transparent" }}>
//         <TextInput
//           placeholder="Search countries"
//           value={searchTerm}
//           onChangeText={setSearchTerm}
//           style={{
//             paddingLeft: 40,
//             paddingRight: 16,
//             paddingVertical: 8,
//             borderRadius: 20,
//             borderWidth: 1,
//             borderColor: "#E5E5E5"
//           }}
//         />
//         <Search style={{ position: "absolute", left: 24, top: 24 }} size={20} />
//       </ThemedView>
      
//       <ScrollView contentContainerStyle={{ padding: 16 }}>
//         <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
//           {filteredCountries.map((country) => (
//             <View key={country.code} style={{ alignItems: "center", width: "30%" }}>
//               <View style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
//                 <Image
//                   source={{ uri: `https://flagcdn.com/w160/${country.code.toLowerCase()}.png` }}
//                   style={{ width: "100%", height: "100%" }}
//                 />
//               </View>
//               <ThemedText style={{ textAlign: "center", fontSize: 12 }}>{country.name}</ThemedText>
//             </View>
//           ))}
//         </View>
//       </ScrollView>
//     </ThemedView>
//   );
// }
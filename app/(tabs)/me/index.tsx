import { Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

export default function Me() {
  return (
    <SafeAreaView>
      <View>
        <Text>Applications</Text>
      </View>
      <View>
        <Text>
          Consultations
        </Text>
      </View>
    </SafeAreaView>
  )
}
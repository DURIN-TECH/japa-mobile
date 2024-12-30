import { Image, Touchable, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ChevronRight, CloudUploadIcon } from 'lucide-react-native';

export default function HomeScreen() {
  return (
    <View className='flex-1 m-2'>
      <ThemedText className='my-2 font-bold'>Required Documents(15) for H1B Immigration to USA</ThemedText>

      {/* Required Files */}
      <ThemedView className='flex-row items-center p-3 mb-4 mx-3 border border-green-200 rounded-lg'>
        <CloudUploadIcon size={24} color='grey' className='w-1/6' />
        <ThemedView className='w-4/6 gap-3'>
          <ThemedText className='text-lg font-bold'>Covid Vaccination Card</ThemedText>
          <TouchableOpacity className='items-center p-1 border border-gray-100 rounded-xl w-2/5'>
            <ThemedText className='text-sm'>Upload</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ChevronRight size={24} color='grey' className='w-1/6'/>
      </ThemedView>

      <ThemedView className='flex-row items-center p-3 mb-4 mx-3 border border-red-200 rounded-lg'>
        <CloudUploadIcon size={24} color='grey' className='w-1/6' />
        <ThemedView className='w-4/6 gap-3'>
          <ThemedText className='text-lg font-bold'>Covid Vaccination Card</ThemedText>
          <TouchableOpacity className='items-center p-1 border border-gray-100 rounded-xl w-2/5'>
            <ThemedText className='text-sm'>Upload</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ChevronRight size={24} color='grey' className='w-1/6'/>
      </ThemedView>

      <ThemedView className='flex-row items-center p-3 mb-4 mx-3 border border-yellow-200 rounded-lg'>
        <CloudUploadIcon size={24} color='grey' className='w-1/6' />
        <ThemedView className='w-4/6 gap-3'>
          <ThemedText className='text-lg font-bold'>Covid Vaccination Card</ThemedText>
          <TouchableOpacity className='items-center p-1 border border-gray-100 rounded-xl w-2/5'>
            <ThemedText className='text-sm'>Upload</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        <ChevronRight size={24} color='grey' className='w-1/6'/>
      </ThemedView>
    </View>
  );
}

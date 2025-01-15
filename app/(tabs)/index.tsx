import { Image, TextInput, Touchable, TouchableOpacity, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { Bell, Search, Calendar, Clock, Award, ArrowRight } from 'lucide-react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView>
      <View className="flex h-screen bg-gray-50 pb-44">
        {/* Header Section */}
        <View className="px-4 py-4 bg-white">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-2xl font-bold text-gray-950">VisaConnect</Text>
              <Text className="text-md text-gray-500">Welcome back, Alex</Text>
            </View>
            <Bell color="#4b5563" size={24} />
          </View>
          
          {/* Search Bar */}
          <View className="flex-row justify-center items-center mt-4">
              <TextInput 
                placeholder="Search countries or visa types..."
                className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <View className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search 
                  size={20}
                  color="#9CA3AF"
                />
              </View>
          </View>
        </View>

        <ScrollView>
          {/* Active Applications Summary */}
          <View className="px-4 py-4">
            <View className="bg-blue-50 p-4 rounded-xl">
              <Text className="font-bold text-blue-900 text-lg">Active Applications</Text>
              <View className="flex-row mt-3 flex justify-between items-center">
                <View className="flex-row items-center space-x-3">
                  <View className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <Calendar color="#2563eb" size={24}/>
                  </View>
                  <View>
                    <Text className="font-semibold text-lg">US Tourist Visa</Text>
                    <Text className="text-sm text-gray-600">In Progress • 2 tasks pending</Text>
                  </View>
                </View>
                <ArrowRight className="w-5 h-5 text-blue-600" />
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="px-4 py-2">
            <Text className="font-bold text-lg text-gray-900 mb-3">Quick Actions</Text>
            <View className="flex-row gap-3 justify-center">
              <TouchableOpacity className="p-4 bg-white rounded-xl border border-gray-200 flex items-center justify-center w-1/2">
                <Calendar size={24} color="#2563eb"/>
                <Text className="text-sm font-medium">Book Consultation</Text>
              </TouchableOpacity>
              <TouchableOpacity className="p-4 bg-white rounded-xl border border-gray-200 flex items-center justify-center w-1/2">
                <Clock size={24} color="#2563eb" />
                <Text className="text-sm font-medium">Track Application</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Featured Agents */}
          <View className="px-4 pt-4">
            <View className="flex-row justify-between mb-3">
              <Text className="font-bold text-lg text-gray-900">Top Rated Agents</Text>
              <TouchableOpacity>
                <Text className="text-md font-medium text-blue-600">
                  View All
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row overflow-x-auto pb-4 gap-3"
            >
              {[1, 2, 3].map((agent) => (
                <View key={agent} className="flex-none w-48 bg-white p-4 rounded-xl border border-gray-200">
                  <View className="flex-row items-center space-x-3 mb-3 gap-3">
                    <View className="w-10 h-10 bg-gray-100 rounded-full" />
                    <View>
                      <Text className="font-medium">Sarah Kim</Text>
                      <Text className="text-sm text-gray-600">US Visa Expert</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center space-x-1 gap-1">
                    <Award size={16} color="#facc15" />
                    <Text className="text-sm font-semibold text-gray-600">4.9 (120 reviews)</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Popular Visas */}
          <View className="px-4 py-2">
            <View className="flex-row justify-between mb-3">
              <Text className="font-bold text-lg text-gray-900">Popular Visas</Text>
              <TouchableOpacity>
                <Text className="text-md font-medium text-blue-600">
                  View All
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="flex-row overflow-x-auto pb-4 gap-3"
            >
              {[
                { type: "Tourist Visa", duration: "6 months", price: "$160", id: 1 },
                { type: "Student Visa", duration: "12 months", price: "$350", id: 2 },
                { type: "Work Visa", duration: "24 months", price: "$460", id: 3 },
              ].map((visa, index) => (
                <TouchableOpacity 
                  key={visa.id} 
                  className="flex-none w-48 bg-white p-4 rounded-xl border border-gray-200"
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                      <Calendar size={20} color="#2563eb" />
                    </View>
                    <View className="ml-3">
                      <Text className="font-semibold text-lg mb-1">{visa.type}</Text>
                      <Text className="text-gray-600 mb-2">{visa.duration}</Text>
                    </View>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="font-bold text-blue-600">{visa.price}</Text>
                    <ArrowRight size={20} color="#2563eb" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Popular Destinations */}
          <View className="px-4 py-2">
            <Text className="font-bold text-lg text-gray-900 mb-3">Popular Destinations</Text>
            <View className="flex-row flex-wrap gap-3">
              {['United States', 'Canada', 'UK', 'Australia'].map((country) => (
                <TouchableOpacity key={country} className="flex-row p-4 bg-white rounded-xl border border-gray-200 justify-between items-center" style={{ width: '48%' }}>
                  <Text className="font-medium">{country}</Text>
                  <ArrowRight size={20} color="#9ca3af"/>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

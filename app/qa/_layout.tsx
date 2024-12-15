// app/(tabs)/qa/index.tsx
import { useState } from 'react';
import { FlatList, StyleSheet, TextInput } from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';

type Question = {
  id: string;
  title: string;
  body: string;
  votes: number;
  answers: number;
}

export default function QAScreen() {
  const [search, setSearch] = useState('');
  const [questions] = useState<Question[]>([
    {
      id: '1',
      title: 'What documents are needed for H1B visa?',
      body: 'I am applying for an H1B visa and need to know...',
      votes: 5,
      answers: 2
    },
    // Add more sample questions
  ]);

  const filteredQuestions = questions.filter(q => 
    q.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.searchContainer}>
        <IconSymbol name="search" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search questions..."
          value={search}
          onChangeText={setSearch}
        />
      </ThemedView>

      <Link href="/qa/ask" style={styles.askButton}>
        <ThemedText>Ask a Question</ThemedText>
      </Link>

      <FlatList
        data={filteredQuestions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Link href={`/qa/${item.id}`} style={styles.questionCard}>
            <ThemedView>
              <ThemedText type="subtitle">{item.title}</ThemedText>
              <ThemedText numberOfLines={2}>{item.body}</ThemedText>
              <ThemedView style={styles.stats}>
                <ThemedText>{item.votes} votes</ThemedText>
                <ThemedText>{item.answers} answers</ThemedText>
              </ThemedView>
            </ThemedView>
          </Link>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  askButton: {
    padding: 12,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  questionCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  }
});
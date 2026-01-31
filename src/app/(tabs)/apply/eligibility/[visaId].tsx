import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react-native';

import {
  useEligibilityQuestions,
  useSubmitEligibilityCheck,
  calculateQuestionProgress,
} from '@/hooks/useEligibility';
import { useAuthStore } from '@/stores/auth.store';
import { useTheme, cn } from '@/hooks/useTheme';
import { Screen, Header, Section, Card, Button, ProgressBar } from '@/components/ui/themed';
import { EligibilityAnswer, EligibilityQuestion } from '@/types/eligibility.type';

export default function EligibilityWizardScreen() {
  const { visaId, countryCode } = useLocalSearchParams<{
    visaId: string;
    countryCode: string;
  }>();
  const { profile } = useAuthStore();
  const { isDark, colors } = useTheme();

  // Get user's nationality from profile
  const nationality = profile?.passportCountry || 'NG'; // Default to Nigeria

  const {
    data: questions,
    isLoading,
    error,
  } = useEligibilityQuestions(visaId ?? '', nationality, countryCode);

  const submitCheck = useSubmitEligibilityCheck();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number | boolean>>({});
  const [showHelp, setShowHelp] = useState(false);

  const currentQuestion = questions?.[currentIndex];
  const isLastQuestion = currentIndex === (questions?.length ?? 0) - 1;
  const progress = calculateQuestionProgress(currentIndex, questions?.length ?? 0);

  // Derive current answer directly from state
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const canProceed = !currentQuestion?.isRequired || currentAnswer !== undefined;

  const handleAnswer = (value: string | string[] | number | boolean) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleNext = async () => {
    if (!questions || !currentQuestion) return;

    // Check if current question is required and unanswered
    if (currentQuestion.isRequired && currentAnswer === undefined) {
      Alert.alert('Required', 'Please answer this question before continuing.');
      return;
    }

    if (isLastQuestion) {
      // Submit the check
      const eligibilityAnswers: EligibilityAnswer[] = Object.entries(answers).map(
        ([questionId, answer]) => ({
          questionId,
          answer,
        })
      );

      try {
        const result = await submitCheck.mutateAsync({
          visaTypeId: visaId ?? '',
          countryCode: countryCode ?? '',
          nationality,
          answers: eligibilityAnswers,
        });

        if (result) {
          router.replace({
            pathname: '/apply/eligibility/result' as const,
            params: { checkId: result.id },
          });
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to submit eligibility check. Please try again.');
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
      setShowHelp(false);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setShowHelp(false);
    } else {
      router.back();
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <Header title="Eligibility Check" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className={cn('mt-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Loading questions...
          </Text>
        </View>
      </Screen>
    );
  }

  if (error || !questions || questions.length === 0) {
    return (
      <Screen>
        <Header title="Eligibility Check" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <AlertCircle size={48} color={isDark ? '#ef4444' : '#dc2626'} />
          <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Unable to load eligibility questions. Please try again.
          </Text>
          <Button onPress={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header with progress */}
      <View className={cn('px-6 pb-4', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        <Header title="Eligibility Check" showBack />
        <View className="flex-row items-center justify-between mb-2 mt-2">
          <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
          <Text className={cn('text-sm font-medium', isDark ? 'text-blue-400' : 'text-blue-600')}>
            {progress}%
          </Text>
        </View>
        <ProgressBar progress={progress} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {currentQuestion && (
          <Section>
            <Card>
              {/* Question */}
              <View className="flex-row items-start justify-between">
                <Text
                  className={cn(
                    'flex-1 text-xl font-semibold',
                    isDark ? 'text-white' : 'text-gray-900'
                  )}
                >
                  {currentQuestion.question}
                </Text>
                {currentQuestion.helpText && (
                  <TouchableOpacity
                    onPress={() => setShowHelp(!showHelp)}
                    className="ml-2"
                  >
                    <HelpCircle size={24} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Description */}
              {currentQuestion.description && (
                <Text
                  className={cn(
                    'mt-2 text-base',
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  )}
                >
                  {currentQuestion.description}
                </Text>
              )}

              {/* Help Text (collapsible) */}
              {showHelp && currentQuestion.helpText && (
                <View
                  className={cn(
                    'mt-4 rounded-lg p-3',
                    isDark ? 'bg-blue-900/30' : 'bg-blue-50'
                  )}
                >
                  <Text className={cn(isDark ? 'text-blue-200' : 'text-blue-800')}>
                    {currentQuestion.helpText}
                  </Text>
                </View>
              )}

              {/* Answer Input */}
              <View className="mt-6">
                <QuestionInput
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={handleAnswer}
                  isDark={isDark}
                  colors={colors}
                />
              </View>
            </Card>
          </Section>
        )}
      </ScrollView>

      {/* Navigation */}
      <View
        className={cn(
          'flex-row items-center justify-between px-6 py-4',
          isDark ? 'bg-gray-800 border-t border-gray-700' : 'bg-white border-t border-gray-200'
        )}
      >
        <TouchableOpacity
          onPress={handleBack}
          className={cn(
            'flex-row items-center px-4 py-3 rounded-xl',
            isDark ? 'bg-gray-700' : 'bg-gray-100'
          )}
        >
          <ChevronLeft size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
          <Text className={cn('ml-1', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={submitCheck.isPending}
          className={cn(
            'flex-row items-center px-6 py-3 rounded-xl',
            submitCheck.isPending ? 'bg-blue-400' : 'bg-blue-600'
          )}
        >
          {submitCheck.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text className="text-white font-semibold mr-1">
                {isLastQuestion ? 'Submit' : 'Next'}
              </Text>
              {isLastQuestion ? (
                <Check size={20} color="#fff" />
              ) : (
                <ChevronRight size={20} color="#fff" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

// ============================================
// QUESTION INPUT COMPONENTS
// ============================================

interface QuestionInputProps {
  question: EligibilityQuestion;
  value: string | string[] | number | boolean | undefined;
  onChange: (value: string | string[] | number | boolean) => void;
  isDark: boolean;
  colors: { primary: string };
}

function QuestionInput({ question, value, onChange, isDark, colors }: QuestionInputProps) {
  switch (question.type) {
    case 'boolean':
      return (
        <BooleanInput
          value={value as boolean | undefined}
          onChange={onChange}
          isDark={isDark}
          colors={colors}
        />
      );

    case 'single':
      return (
        <SingleChoiceInput
          options={question.options ?? []}
          value={value as string | undefined}
          onChange={onChange}
          isDark={isDark}
          colors={colors}
        />
      );

    case 'multiple':
      return (
        <MultipleChoiceInput
          options={question.options ?? []}
          value={value as string[] | undefined}
          onChange={onChange}
          isDark={isDark}
          colors={colors}
        />
      );

    case 'number':
      return (
        <NumberInput
          value={value as number | undefined}
          onChange={onChange}
          min={question.minValue}
          max={question.maxValue}
          unit={question.unit}
          isDark={isDark}
        />
      );

    case 'text':
      return (
        <TextInputField
          value={value as string | undefined}
          onChange={onChange}
          isDark={isDark}
        />
      );

    default:
      return null;
  }
}

function BooleanInput({
  value,
  onChange,
  isDark,
  colors,
}: {
  value: boolean | undefined;
  onChange: (val: boolean) => void;
  isDark: boolean;
  colors: { primary: string };
}) {
  return (
    <View className="flex-row gap-4">
      <TouchableOpacity
        onPress={() => onChange(true)}
        className={cn(
          'flex-1 rounded-xl py-4 items-center border-2',
          value === true
            ? 'border-blue-500 bg-blue-500/10'
            : isDark
            ? 'border-gray-600 bg-gray-700'
            : 'border-gray-200 bg-gray-50'
        )}
      >
        <Text
          className={cn(
            'text-lg font-semibold',
            value === true
              ? 'text-blue-600'
              : isDark
              ? 'text-gray-300'
              : 'text-gray-700'
          )}
        >
          Yes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onChange(false)}
        className={cn(
          'flex-1 rounded-xl py-4 items-center border-2',
          value === false
            ? 'border-blue-500 bg-blue-500/10'
            : isDark
            ? 'border-gray-600 bg-gray-700'
            : 'border-gray-200 bg-gray-50'
        )}
      >
        <Text
          className={cn(
            'text-lg font-semibold',
            value === false
              ? 'text-blue-600'
              : isDark
              ? 'text-gray-300'
              : 'text-gray-700'
          )}
        >
          No
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SingleChoiceInput({
  options,
  value,
  onChange,
  isDark,
  colors,
}: {
  options: string[];
  value: string | undefined;
  onChange: (val: string) => void;
  isDark: boolean;
  colors: { primary: string };
}) {
  return (
    <View className="gap-3">
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          onPress={() => onChange(option)}
          className={cn(
            'rounded-xl py-4 px-4 border-2',
            value === option
              ? 'border-blue-500 bg-blue-500/10'
              : isDark
              ? 'border-gray-600 bg-gray-700'
              : 'border-gray-200 bg-gray-50'
          )}
        >
          <View className="flex-row items-center">
            <View
              className={cn(
                'w-6 h-6 rounded-full border-2 items-center justify-center mr-3',
                value === option
                  ? 'border-blue-500 bg-blue-500'
                  : isDark
                  ? 'border-gray-500'
                  : 'border-gray-300'
              )}
            >
              {value === option && <Check size={14} color="#fff" />}
            </View>
            <Text
              className={cn(
                'text-base',
                isDark ? 'text-gray-200' : 'text-gray-800'
              )}
            >
              {option}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MultipleChoiceInput({
  options,
  value,
  onChange,
  isDark,
  colors,
}: {
  options: string[];
  value: string[] | undefined;
  onChange: (val: string[]) => void;
  isDark: boolean;
  colors: { primary: string };
}) {
  const selectedOptions = value || [];

  const toggleOption = (option: string) => {
    if (selectedOptions.includes(option)) {
      onChange(selectedOptions.filter((o) => o !== option));
    } else {
      onChange([...selectedOptions, option]);
    }
  };

  return (
    <View className="gap-3">
      {options.map((option) => {
        const isSelected = selectedOptions.includes(option);
        return (
          <TouchableOpacity
            key={option}
            onPress={() => toggleOption(option)}
            className={cn(
              'rounded-xl py-4 px-4 border-2',
              isSelected
                ? 'border-blue-500 bg-blue-500/10'
                : isDark
                ? 'border-gray-600 bg-gray-700'
                : 'border-gray-200 bg-gray-50'
            )}
          >
            <View className="flex-row items-center">
              <View
                className={cn(
                  'w-6 h-6 rounded border-2 items-center justify-center mr-3',
                  isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : isDark
                    ? 'border-gray-500'
                    : 'border-gray-300'
                )}
              >
                {isSelected && <Check size={14} color="#fff" />}
              </View>
              <Text
                className={cn(
                  'text-base',
                  isDark ? 'text-gray-200' : 'text-gray-800'
                )}
              >
                {option}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  unit,
  isDark,
}: {
  value: number | undefined;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  isDark: boolean;
}) {
  return (
    <View className="flex-row items-center">
      <TextInput
        value={value !== undefined ? String(value) : ''}
        onChangeText={(text) => {
          const num = parseInt(text, 10);
          if (!isNaN(num)) {
            onChange(num);
          } else if (text === '') {
            onChange(0);
          }
        }}
        keyboardType="numeric"
        placeholder={min !== undefined && max !== undefined ? `${min}-${max}` : 'Enter number'}
        placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
        className={cn(
          'flex-1 rounded-xl py-4 px-4 text-lg',
          isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
        )}
      />
      {unit && (
        <Text className={cn('ml-3 text-base', isDark ? 'text-gray-400' : 'text-gray-600')}>
          {unit}
        </Text>
      )}
    </View>
  );
}

function TextInputField({
  value,
  onChange,
  isDark,
}: {
  value: string | undefined;
  onChange: (val: string) => void;
  isDark: boolean;
}) {
  return (
    <TextInput
      value={value || ''}
      onChangeText={onChange}
      multiline
      numberOfLines={4}
      placeholder="Enter your answer"
      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
      textAlignVertical="top"
      className={cn(
        'rounded-xl py-4 px-4 text-base min-h-[120px]',
        isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
      )}
    />
  );
}

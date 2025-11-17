// --- START OF FILE AnimatedPage.tsx ---

import { motion } from 'framer-motion';
import React from 'react';

// Определяем варианты анимации
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20, // Начинаем на 20px ниже
  },
  in: {
    opacity: 1,
    y: 0, // Поднимаемся в исходное положение
  },
  out: {
    opacity: 0,
    y: -20, // Уходим на 20px вверх
  },
};

// Определяем свойства перехода (длительность, тип)
const pageTransition = {
  type: 'tween' as const, // Плавный переход
  ease: 'anticipate' as const, // Эффектный тип замедления
  duration: 0.5, // Длительность 0.5 секунды
};

interface AnimatedPageProps {
  children: React.ReactNode;
}

export function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <motion.div
      initial="initial" // Начальное состояние
      animate="in"      // Анимация при появлении
      exit="out"        // Анимация при исчезновении
      variants={pageVariants}
      transition={pageTransition}
      style={{ width: '100%', height: '100%' }} // Сохраняем размеры
    >
      {children}
    </motion.div>
  );
}

// Экспортируем PageTransition как алиас для AnimatedPage для совместимости
export const PageTransition = AnimatedPage;
import { useState, useCallback, useMemo } from 'react';

/**
 * Универсальный хук для управления выбором элементов любого типа.
 * Поддерживает множественный выбор с типизацией.
 * 
 * @template T - Тип идентификатора (string, number, etc.)
 * @param options - Опции для настройки поведения хука
 * @returns Объект с состоянием и методами для управления выбором
 * 
 * @example
 * ```tsx
 * // Для строковых ID
 * const fileSelection = useSelection<string>({
 *   getId: (file) => file.id
 * });
 * 
 * // Для числовых ID
 * const keySelection = useSelection<number>({
 *   getId: (key) => key.id
 * });
 * ```
 */
export interface UseSelectionOptions<TItem, TId> {
  /**
   * Функция для получения идентификатора из элемента
   */
  getId: (item: TItem) => TId;
  
  /**
   * Начальное состояние выбранных элементов
   */
  initialSelected?: TId[];
  
  /**
   * Функция сравнения идентификаторов (по умолчанию используется строгое равенство)
   */
  equals?: (a: TId, b: TId) => boolean;
}

export interface UseSelectionReturn<TItem, TId> {
  /**
   * Массив выбранных идентификаторов
   */
  selectedIds: TId[];
  
  /**
   * Количество выбранных элементов
   */
  selectedCount: number;
  
  /**
   * Переключить выбор элемента
   */
  toggle: (id: TId) => void;
  
  /**
   * Выбрать элемент
   */
  select: (id: TId) => void;
  
  /**
   * Снять выбор с элемента
   */
  deselect: (id: TId) => void;
  
  /**
   * Выбрать все элементы из списка
   */
  selectAll: (items: TItem[]) => void;
  
  /**
   * Снять выбор со всех элементов
   */
  clear: () => void;
  
  /**
   * Проверить, выбран ли элемент
   */
  isSelected: (id: TId) => boolean;
  
  /**
   * Проверить, выбраны ли все элементы из списка
   */
  isAllSelected: (items: TItem[]) => boolean;
  
  /**
   * Проверить, выбран ли хотя бы один элемент из списка
   */
  isSomeSelected: (items: TItem[]) => boolean;
  
  /**
   * Получить выбранные объекты из списка
   */
  getSelectedItems: (items: TItem[]) => TItem[];
  
  /**
   * Установить выбранные идентификаторы напрямую
   */
  setSelectedIds: (ids: TId[]) => void;
}

/**
 * Универсальный хук для управления выбором элементов
 */
export function useSelection<TItem, TId = string | number>(
  options: UseSelectionOptions<TItem, TId>
): UseSelectionReturn<TItem, TId> {
  const { getId, initialSelected = [], equals = (a, b) => a === b } = options;
  
  const [selectedIds, setSelectedIds] = useState<TId[]>(initialSelected);

  const toggle = useCallback((id: TId) => {
    setSelectedIds((prev) => {
      const index = prev.findIndex((selectedId) => equals(selectedId, id));
      if (index >= 0) {
        return prev.filter((selectedId) => !equals(selectedId, id));
      }
      return [...prev, id];
    });
  }, [equals]);

  const select = useCallback((id: TId) => {
    setSelectedIds((prev) => {
      if (prev.some((selectedId) => equals(selectedId, id))) {
        return prev;
      }
      return [...prev, id];
    });
  }, [equals]);

  const deselect = useCallback((id: TId) => {
    setSelectedIds((prev) => prev.filter((selectedId) => !equals(selectedId, id)));
  }, [equals]);

  const selectAll = useCallback((items: TItem[]) => {
    const allIds = items.map(getId);
    setSelectedIds((prev) => {
      // Если все уже выбраны - снимаем выбор
      const allSelected = allIds.every((id) => 
        prev.some((selectedId) => equals(selectedId, id))
      );
      
      if (allSelected && allIds.length > 0) {
        // Снимаем выбор только с этих элементов
        return prev.filter((selectedId) => 
          !allIds.some((id) => equals(selectedId, id))
        );
      }
      
      // Добавляем недостающие элементы
      const newIds = allIds.filter((id) => 
        !prev.some((selectedId) => equals(selectedId, id))
      );
      return [...prev, ...newIds];
    });
  }, [getId, equals]);

  const clear = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isSelected = useCallback((id: TId) => {
    return selectedIds.some((selectedId) => equals(selectedId, id));
  }, [selectedIds, equals]);

  const isAllSelected = useCallback((items: TItem[]) => {
    if (items.length === 0) return false;
    const itemIds = items.map(getId);
    return itemIds.every((id) => isSelected(id));
  }, [getId, isSelected]);

  const isSomeSelected = useCallback((items: TItem[]) => {
    if (items.length === 0) return false;
    const itemIds = items.map(getId);
    return itemIds.some((id) => isSelected(id));
  }, [getId, isSelected]);

  const getSelectedItems = useCallback((items: TItem[]) => {
    return items.filter((item) => isSelected(getId(item)));
  }, [getId, isSelected]);

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds.length]);

  return {
    selectedIds,
    selectedCount,
    toggle,
    select,
    deselect,
    selectAll,
    clear,
    isSelected,
    isAllSelected,
    isSomeSelected,
    getSelectedItems,
    setSelectedIds,
  };
}

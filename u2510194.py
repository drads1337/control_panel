def mergeSort(lst):
    if len(lst) <= 1:
        return lst
    
    mid = len(lst) // 2
    left = mergeSort(lst[:mid])
    right = mergeSort(lst[mid:])
    
    return merge(left, right)

def merge(left, right):
    result = []
    left_idx, right_idx = 0, 0
    
    while left_idx < len(left) and right_idx < len(right):
        if left[left_idx] <= right[right_idx]:
            result.append(left[left_idx])
            left_idx += 1
        else:
            result.append(right[right_idx])
            right_idx += 1
            
    if left_idx < len(left):
        result.extend(left[left_idx:])
    if right_idx < len(right):
        result.extend(right[right_idx:])
        
    return result

def find_factors(number):
    factors = []
    for i in range(1, number + 1):
        if number % i == 0:
            factors.append(i)
    return factors

def horner_recursive(coeffs, x):
    if not coeffs:
        return 0
    return coeffs[0] + x * horner_recursive(coeffs[1:], x)

def CodeWrite(num):
    while (num < 100):
        flag = 0
        i = 2
        while(i <= num/2):
            if(num % i == 0):
                flag = 1
                break
            i = i + 1
        if flag == 0:
            print(num)
        num = num + 1

def MysteryPrint(N):
    if (N > 0):
        print(N)
        MysteryPrint(N - 2)
    else:
        print(N)
        if (N > -1):
            MysteryPrint(N + 1)

def find_first_duplicate(arr):
    seen = set()
    for num in arr:
        if num in seen:
            return num
        seen.add(num)
    return -1

def frequency_dict(lst):
    freq = {i: 0 for i in range(10)}
    for item in lst:
        if item in freq:
            freq[item] += 1
    return freq

def recursive_list_sum(data_list):
    total = 0
    for element in data_list:
        if isinstance(element, list):
            total += recursive_list_sum(element)
        else:
            total += element
    return total

if __name__ == "__main__":
    print("--- Task 1.1 Merge Sort ---")
    arr = [3, 1, 4, 1, 5, 9, 2, 6, 5, 4]
    print(mergeSort(arr))

    print("\n--- Task 1.2 Factors of 12 ---")
    print(find_factors(12))

    print("\n--- Task 1.3 Horner's Rule ---")
    print(horner_recursive([3, 2, 1], 2))

    print("\n--- Task 2.1 CodeWrite(1) ---")
    CodeWrite(1)

    print("\n--- Task 2.2 MysteryPrint(2) ---")
    MysteryPrint(2)

    print("\n--- Task 2.3 First Duplicate ---")
    print(find_first_duplicate([1, 2, 3, 4, 2, 5]))

    print("\n--- Task 2.4 Frequency Dictionary ---")
    print(frequency_dict([2, 1, 2, 3, 1, 9]))

    print("\n--- Task 2.5 Recursive List Sum ---")
    print(recursive_list_sum([1, 2, [3, 4], [5, 6]]))
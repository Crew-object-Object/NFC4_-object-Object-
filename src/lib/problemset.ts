export type TestCase = {
	input: string;
	output: string;
};

export type Problem = {
	title: string;
	description: string;
	difficulty: 'easy' | 'medium' | 'hard';
	tags: string[];
	testCases: TestCase[];
};

export const problemset: Problem[] = [
	{
		title: "Two Sum",
		description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.

Example:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].`,
		difficulty: 'easy',
		tags: ['array', 'hash table'],
		testCases: [
			{
				input: JSON.stringify({ nums: [2, 7, 11, 15], target: 9 }),
				output: JSON.stringify([0, 1])
			},
			{
				input: JSON.stringify({ nums: [3, 2, 4], target: 6 }),
				output: JSON.stringify([1, 2])
			},
			{
				input: JSON.stringify({ nums: [3, 3], target: 6 }),
				output: JSON.stringify([0, 1])
			}
		]
	},
	{
		title: "Reverse Linked List",
		description: `Given the head of a singly linked list, reverse the list, and return the reversed list.

Example:
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]

Example:
Input: head = [1,2]
Output: [2,1]

Example:
Input: head = []
Output: []`,
		difficulty: 'easy',
		tags: ['linked list', 'recursion'],
		testCases: [
			{
				input: JSON.stringify([1, 2, 3, 4, 5]),
				output: JSON.stringify([5, 4, 3, 2, 1])
			},
			{
				input: JSON.stringify([1, 2]),
				output: JSON.stringify([2, 1])
			},
			{
				input: JSON.stringify([]),
				output: JSON.stringify([])
			}
		]
	},
	{
		title: "Valid Parentheses",
		description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

Example:
Input: s = "()"
Output: true

Example:
Input: s = "()[]{}"
Output: true

Example:
Input: s = "(]"
Output: false`,
		difficulty: 'easy',
		tags: ['string', 'stack'],
		testCases: [
			{
				input: JSON.stringify("()"),
				output: JSON.stringify(true)
			},
			{
				input: JSON.stringify("()[]{}"),
				output: JSON.stringify(true)
			},
			{
				input: JSON.stringify("(]"),
				output: JSON.stringify(false)
			},
			{
				input: JSON.stringify("([)]"),
				output: JSON.stringify(false)
			}
		]
	},
	{
		title: "Binary Search",
		description: `Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.

You must write an algorithm with O(log n) runtime complexity.

Example:
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
Explanation: 9 exists in nums and its index is 4

Example:
Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
Explanation: 2 does not exist in nums so return -1`,
		difficulty: 'easy',
		tags: ['array', 'binary search'],
		testCases: [
			{
				input: JSON.stringify({ nums: [-1, 0, 3, 5, 9, 12], target: 9 }),
				output: JSON.stringify(4)
			},
			{
				input: JSON.stringify({ nums: [-1, 0, 3, 5, 9, 12], target: 2 }),
				output: JSON.stringify(-1)
			},
			{
				input: JSON.stringify({ nums: [5], target: 5 }),
				output: JSON.stringify(0)
			}
		]
	},
	{
		title: "Add Two Numbers",
		description: `You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.

You may assume the two numbers do not contain any leading zero, except the number 0 itself.

Example:
Input: l1 = [2,4,3], l2 = [5,6,4]
Output: [7,0,8]
Explanation: 342 + 465 = 807.

Example:
Input: l1 = [0], l2 = [0]
Output: [0]

Example:
Input: l1 = [9,9,9,9,9,9,9], l2 = [9,9,9,9]
Output: [8,9,9,9,0,0,0,1]`,
		difficulty: 'medium',
		tags: ['linked list', 'math', 'recursion'],
		testCases: [
			{
				input: JSON.stringify({ l1: [2, 4, 3], l2: [5, 6, 4] }),
				output: JSON.stringify([7, 0, 8])
			},
			{
				input: JSON.stringify({ l1: [0], l2: [0] }),
				output: JSON.stringify([0])
			},
			{
				input: JSON.stringify({ l1: [9, 9, 9, 9, 9, 9, 9], l2: [9, 9, 9, 9] }),
				output: JSON.stringify([8, 9, 9, 9, 0, 0, 0, 1])
			}
		]
	},
	{
		title: "Longest Substring Without Repeating Characters",
		description: `Given a string s, find the length of the longest substring without repeating characters.

Example:
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.

Example:
Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.

Example:
Input: s = "pwwkew"
Output: 3
Explanation: The answer is "wke", with the length of 3.
Notice that the answer must be a substring, "pwke" is a subsequence and not a substring.`,
		difficulty: 'medium',
		tags: ['hash table', 'string', 'sliding window'],
		testCases: [
			{
				input: JSON.stringify("abcabcbb"),
				output: JSON.stringify(3)
			},
			{
				input: JSON.stringify("bbbbb"),
				output: JSON.stringify(1)
			},
			{
				input: JSON.stringify("pwwkew"),
				output: JSON.stringify(3)
			},
			{
				input: JSON.stringify(""),
				output: JSON.stringify(0)
			}
		]
	},
	{
		title: "Container With Most Water",
		description: `You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]).

Find two lines that together with the x-axis form a container that can contain the most water.

Return the maximum amount of water a container can store.

Notice that you may not slant the container.

Example:
Input: height = [1,8,6,2,5,4,8,3,7]
Output: 49
Explanation: The above vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. In this case, the max area of water (blue section) the container can contain is 49.

Example:
Input: height = [1,1]
Output: 1`,
		difficulty: 'medium',
		tags: ['array', 'two pointers', 'greedy'],
		testCases: [
			{
				input: JSON.stringify([1, 8, 6, 2, 5, 4, 8, 3, 7]),
				output: JSON.stringify(49)
			},
			{
				input: JSON.stringify([1, 1]),
				output: JSON.stringify(1)
			},
			{
				input: JSON.stringify([4, 3, 2, 1, 4]),
				output: JSON.stringify(16)
			}
		]
	},
	{
		title: "Merge k Sorted Lists",
		description: `You are given an array of k linked-lists lists, each linked-list is sorted in ascending order.

Merge all the linked-lists into one sorted linked-list and return it.

Example:
Input: lists = [[1,4,5],[1,3,4],[2,6]]
Output: [1,1,2,3,4,4,5,6]
Explanation: The linked-lists are:
[
  1->4->5,
  1->3->4,
  2->6
]
merging them into one sorted list:
1->1->2->3->4->4->5->6

Example:
Input: lists = []
Output: []

Example:
Input: lists = [[]]
Output: []`,
		difficulty: 'hard',
		tags: ['linked list', 'divide and conquer', 'heap', 'merge sort'],
		testCases: [
			{
				input: JSON.stringify([[1, 4, 5], [1, 3, 4], [2, 6]]),
				output: JSON.stringify([1, 1, 2, 3, 4, 4, 5, 6])
			},
			{
				input: JSON.stringify([]),
				output: JSON.stringify([])
			},
			{
				input: JSON.stringify([[]]),
				output: JSON.stringify([])
			}
		]
	},
	{
		title: "Median of Two Sorted Arrays",
		description: `Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.

The overall run time complexity should be O(log (m+n)).

Example:
Input: nums1 = [1,3], nums2 = [2]
Output: 2.00000
Explanation: merged array = [1,2,3] and median is 2.

Example:
Input: nums1 = [1,2], nums2 = [3,4]
Output: 2.50000
Explanation: merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.`,
		difficulty: 'hard',
		tags: ['array', 'binary search', 'divide and conquer'],
		testCases: [
			{
				input: JSON.stringify({ nums1: [1, 3], nums2: [2] }),
				output: JSON.stringify(2.0)
			},
			{
				input: JSON.stringify({ nums1: [1, 2], nums2: [3, 4] }),
				output: JSON.stringify(2.5)
			},
			{
				input: JSON.stringify({ nums1: [0, 0], nums2: [0, 0] }),
				output: JSON.stringify(0.0)
			}
		]
	},
	{
		title: "Regular Expression Matching",
		description: `Given an input string s and a pattern p, implement regular expression matching with support for '.' and '*' where:

'.' Matches any single character.
'*' Matches zero or more of the preceding element.

The matching should cover the entire input string (not partial).

Example:
Input: s = "aa", p = "a"
Output: false
Explanation: "a" does not match the entire string "aa".

Example:
Input: s = "aa", p = "a*"
Output: true
Explanation: '*' means zero or more of the preceding element, 'a'. Therefore, by repeating 'a' once, it becomes "aa".

Example:
Input: s = "ab", p = ".*"
Output: true
Explanation: ".*" means "zero or more (*) of any character (.)".`,
		difficulty: 'hard',
		tags: ['string', 'dynamic programming', 'recursion'],
		testCases: [
			{
				input: JSON.stringify({ s: "aa", p: "a" }),
				output: JSON.stringify(false)
			},
			{
				input: JSON.stringify({ s: "aa", p: "a*" }),
				output: JSON.stringify(true)
			},
			{
				input: JSON.stringify({ s: "ab", p: ".*" }),
				output: JSON.stringify(true)
			},
			{
				input: JSON.stringify({ s: "aab", p: "c*a*b" }),
				output: JSON.stringify(true)
			}
		]
	}
];

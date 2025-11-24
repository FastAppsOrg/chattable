/**
 * Generate a random project name in the format: adjective-noun-number-timestamp
 * Examples: "fancy-star-947-4014", "bright-moon-123-5021"
 */

const adjectives = [
  'happy', 'bright', 'quick', 'calm', 'fancy', 'bold', 'wise', 'cool',
  'swift', 'noble', 'pure', 'warm', 'kind', 'wild', 'free', 'true',
  'grand', 'proud', 'brave', 'smart', 'clear', 'strong', 'gentle', 'silver',
]

const nouns = [
  'star', 'moon', 'sun', 'wave', 'wind', 'tree', 'bird', 'fish',
  'lion', 'wolf', 'bear', 'eagle', 'river', 'ocean', 'cloud', 'storm',
  'fire', 'ice', 'rock', 'pearl', 'jade', 'ruby', 'gold', 'sky',
]

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomNumber(max: number): number {
  return Math.floor(Math.random() * max)
}

export function generateProjectName(): string {
  const adjective = getRandomElement(adjectives)
  const noun = getRandomElement(nouns)
  const randomNum = getRandomNumber(1000)
  const timestamp = Date.now() % 10000 // Last 4 digits of timestamp

  return `${adjective}-${noun}-${randomNum}-${timestamp}`
}

export function generateProjectId(name?: string): string {
  if (name && name.trim()) {
    // If user provided a name, convert it to a safe ID
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }
  // Otherwise generate a random name
  return generateProjectName()
}

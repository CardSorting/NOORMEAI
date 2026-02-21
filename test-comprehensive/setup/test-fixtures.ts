/**
 * Test data fixtures for NOORM comprehensive testing
 */

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  age?: number
  active: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface Profile {
  id: string
  userId: string
  bio?: string
  avatar?: string
  website?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Post {
  id: string
  userId: string
  title: string
  content: string
  published: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface Comment {
  id: string
  postId: string
  userId: string
  content: string
  createdAt?: Date
  updatedAt?: Date
}

export interface Tag {
  id: string
  name: string
  color?: string
  createdAt?: Date
}

export interface PostTag {
  postId: string
  tagId: string
}

/**
 * Generate test users
 */
export function generateUsers(count: number = 10): User[] {
  const users: User[] = []
  
  for (let i = 1; i <= count; i++) {
    users.push({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      firstName: `User${i}`,
      lastName: `LastName${i}`,
      age: 20 + (i % 50),
      active: i % 3 !== 0, // Every third user is inactive
      createdAt: new Date(Date.now() - i * 1000 * 60 * 60), // Spread over time
      updatedAt: new Date()
    })
  }
  
  return users
}

/**
 * Generate test profiles
 */
export function generateProfiles(users: User[]): Profile[] {
  return users.slice(0, Math.floor(users.length * 0.8)).map(user => ({
    id: `profile-${user.id}`,
    userId: user.id,
    bio: `Bio for ${user.firstName} ${user.lastName}`,
    avatar: `https://example.com/avatars/${user.id}.jpg`,
    website: `https://${user.firstName.toLowerCase()}.com`,
    createdAt: user.createdAt,
    updatedAt: new Date()
  }))
}

/**
 * Generate test posts
 */
export function generatePosts(users: User[], count: number = 20): Post[] {
  const posts: Post[] = []
  
  for (let i = 1; i <= count; i++) {
    const user = users[i % users.length]
    posts.push({
      id: `post-${i}`,
      userId: user.id,
      title: `Post Title ${i}`,
      content: `This is the content for post ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
      published: i % 2 === 0, // Every other post is published
      createdAt: new Date(Date.now() - i * 1000 * 60 * 30), // Spread over time
      updatedAt: new Date()
    })
  }
  
  return posts
}

/**
 * Generate test comments
 */
export function generateComments(posts: Post[], users: User[], count: number = 50): Comment[] {
  const comments: Comment[] = []
  
  for (let i = 1; i <= count; i++) {
    const post = posts[i % posts.length]
    const user = users[i % users.length]
    
    comments.push({
      id: `comment-${i}`,
      postId: post.id,
      userId: user.id,
      content: `This is comment ${i} on post "${post.title}". Great post!`,
      createdAt: new Date(Date.now() - i * 1000 * 60 * 10), // Spread over time
      updatedAt: new Date()
    })
  }
  
  return comments
}

/**
 * Generate test tags
 */
export function generateTags(): Tag[] {
  return [
    { id: 'tag-1', name: 'javascript', color: '#f7df1e' },
    { id: 'tag-2', name: 'typescript', color: '#3178c6' },
    { id: 'tag-3', name: 'database', color: '#336791' },
    { id: 'tag-4', name: 'design', color: '#ff6b6b' },
    { id: 'tag-5', name: 'react', color: '#61dafb' },
    { id: 'tag-6', name: 'nodejs', color: '#339933' },
    { id: 'tag-7', name: 'sql', color: '#cc2927' },
    { id: 'tag-8', name: 'nosql', color: '#4db33d' },
    { id: 'tag-9', name: 'testing', color: '#99425b' },
    { id: 'tag-10', name: 'performance', color: '#ff9500' }
  ]
}

/**
 * Generate post-tag relationships
 */
export function generatePostTags(posts: Post[], tags: Tag[]): PostTag[] {
  const postTags: PostTag[] = []
  
  for (const post of posts) {
    // Each post gets 1-3 random tags
    const tagCount = Math.floor(Math.random() * 3) + 1
    const shuffledTags = [...tags].sort(() => Math.random() - 0.5)
    
    for (let i = 0; i < tagCount; i++) {
      postTags.push({
        postId: post.id,
        tagId: shuffledTags[i].id
      })
    }
  }
  
  return postTags
}

/**
 * Generate a complete test dataset
 */
export function generateTestDataset(options: {
  userCount?: number
  postCount?: number
  commentCount?: number
} = {}): {
  users: User[]
  profiles: Profile[]
  posts: Post[]
  comments: Comment[]
  tags: Tag[]
  postTags: PostTag[]
} {
  const { userCount = 10, postCount = 20, commentCount = 50 } = options
  
  const users = generateUsers(userCount)
  const profiles = generateProfiles(users)
  const posts = generatePosts(users, postCount)
  const comments = generateComments(posts, users, commentCount)
  const tags = generateTags()
  const postTags = generatePostTags(posts, tags)
  
  return {
    users,
    profiles,
    posts,
    comments,
    tags,
    postTags
  }
}

/**
 * Generate large dataset for performance testing
 */
export function generateLargeDataset(): {
  users: User[]
  profiles: Profile[]
  posts: Post[]
  comments: Comment[]
  tags: Tag[]
  postTags: PostTag[]
} {
  return generateTestDataset({
    userCount: 1000,
    postCount: 5000,
    commentCount: 25000
  })
}

/**
 * Generate stress test dataset
 */
export function generateStressDataset(): {
  users: User[]
  profiles: Profile[]
  posts: Post[]
  comments: Comment[]
  tags: Tag[]
  postTags: PostTag[]
} {
  return generateTestDataset({
    userCount: 10000,
    postCount: 50000,
    commentCount: 250000
  })
}

/**
 * Generate random test data for specific scenarios
 */
export const randomTestData = {
  /**
   * Generate random user
   */
  user(): User {
    const id = Math.random().toString(36).substr(2, 9)
    return {
      id: `user-${id}`,
      email: `user${id}@example.com`,
      firstName: `User${id}`,
      lastName: `LastName${id}`,
      age: Math.floor(Math.random() * 50) + 18,
      active: Math.random() > 0.2,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },

  /**
   * Generate random post
   */
  post(userId: string): Post {
    const id = Math.random().toString(36).substr(2, 9)
    return {
      id: `post-${id}`,
      userId,
      title: `Random Post ${id}`,
      content: `Random content for post ${id}. Lorem ipsum dolor sit amet.`,
      published: Math.random() > 0.5,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },

  /**
   * Generate random comment
   */
  comment(postId: string, userId: string): Comment {
    const id = Math.random().toString(36).substr(2, 9)
    return {
      id: `comment-${id}`,
      postId,
      userId,
      content: `Random comment ${id}. Great post!`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },

  /**
   * Generate random tag
   */
  tag(): Tag {
    const id = Math.random().toString(36).substr(2, 9)
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3']
    return {
      id: `tag-${id}`,
      name: `tag-${id}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      createdAt: new Date()
    }
  }
}

/**
 * Test data for specific scenarios
 */
export const scenarioTestData = {
  /**
   * Data for testing relationships
   */
  relationshipTest: {
    users: [
      { id: 'user-1', email: 'user1@test.com', firstName: 'User1', lastName: 'Test', active: true },
      { id: 'user-2', email: 'user2@test.com', firstName: 'User2', lastName: 'Test', active: true }
    ],
    profiles: [
      { id: 'profile-1', userId: 'user-1', bio: 'Test bio 1' },
      { id: 'profile-2', userId: 'user-2', bio: 'Test bio 2' }
    ],
    posts: [
      { id: 'post-1', userId: 'user-1', title: 'Test Post 1', content: 'Content 1', published: true },
      { id: 'post-2', userId: 'user-1', title: 'Test Post 2', content: 'Content 2', published: false },
      { id: 'post-3', userId: 'user-2', title: 'Test Post 3', content: 'Content 3', published: true }
    ],
    comments: [
      { id: 'comment-1', postId: 'post-1', userId: 'user-2', content: 'Comment 1' },
      { id: 'comment-2', postId: 'post-1', userId: 'user-1', content: 'Comment 2' },
      { id: 'comment-3', postId: 'post-3', userId: 'user-1', content: 'Comment 3' }
    ]
  },

  /**
   * Data for testing performance
   */
  performanceTest: generateLargeDataset(),

  /**
   * Data for testing stress scenarios
   */
  stressTest: generateStressDataset(),

  /**
   * Data for testing edge cases
   */
  edgeCases: {
    users: [
      { id: 'user-empty', email: '', firstName: '', lastName: '', active: false },
      { id: 'user-null', email: 'null@test.com', firstName: null, lastName: null, active: true },
      { id: 'user-unicode', email: '测试@example.com', firstName: '测试', lastName: '用户', active: true }
    ],
    posts: [
      { id: 'post-empty', userId: 'user-1', title: '', content: '', published: false },
      { id: 'post-long', userId: 'user-1', title: 'A'.repeat(1000), content: 'B'.repeat(10000), published: true }
    ]
  }
}

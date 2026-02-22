import { NOORMME } from 'noormme'
import type { 



} from './database'



export class RepositoryFactory {
  constructor(private db: NOORMME) {}


}

// Convenience function to create repository factory
export function createRepositoryFactory(db: NOORMME): RepositoryFactory {
  return new RepositoryFactory(db)
}

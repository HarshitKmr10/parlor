// utils/objectUtils.ts
export class ObjectUtilsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectUtilsError';
  }
}

export const ObjectUtils = {
  parseObject: (objectArg: string | null): Record<string, any> => {
    try {
      return objectArg ? JSON.parse(objectArg) : {};
    } catch (error) {
      console.error('Error parsing object:', error);
      throw new ObjectUtilsError('Failed to parse object');
    }
  },

  isEmptyObject: (objectArg: string | null): boolean => {
    try {
      const parsedObj = ObjectUtils.parseObject(objectArg);
      return Object.keys(parsedObj).length === 0;
    } catch (error) {
      console.error('Error checking if object is empty:', error);
      throw new ObjectUtilsError('Failed to check if object is empty');
    }
  },
};

import { checkRateLimit } from "../utils/ratelimiter";

interface RateLimitOptions {
    capacity: number;
    refillRate: number;
}

export function RateLimit(options: RateLimitOptions){
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ){
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]){

           const request =  args.find(arg => arg?.headers);

            const key = request?.user?.id?.toString() ||
            request?.body?.username?.toLowerCase() ||
            request?.headers['x-forwarded-for']?.split(',')[0] ||
            request?.ip ||
            'anonymous';

           const allowed = checkRateLimit(key, options);
           if(!allowed){
            const error: any = new Error("Too Many Requests");
            error.status = 429;
            throw error;
           }
           return originalMethod.apply(this, args);
        };
        return descriptor;
    }
}
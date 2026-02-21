interface Bucket {
    tokens: number;
    lastRefill: number;
}

interface RateLimiterConfig {
    capacity: number; //max tokens
    refillRate: number; //tokens per second
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
    key: string, 
    config: RateLimiterConfig
){
    let now = Date.now();
    let bucket = buckets.get(key);

    if(!bucket){
        bucket = {
            tokens: config.capacity,
            lastRefill: now
        };
        buckets.set(key, bucket);
    }
    //Refill tokens
    const timepassed = (now - bucket.lastRefill) / 1000;
    const refillTokens = timepassed * config.refillRate;

    bucket.tokens = Math.min(config.capacity, bucket.tokens + refillTokens);
    bucket.lastRefill = now;

    if(bucket.tokens >= 1){
        bucket.tokens = bucket.tokens - 1;
        return true;
    }
    return false;
}


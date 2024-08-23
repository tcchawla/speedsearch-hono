import { Hono } from "hono"
import { handle } from "hono/vercel"
import { env } from "hono/adapter"
import { cors } from "hono/cors"
import { Redis } from "@upstash/redis/cloudflare"

export const runtime = "edge"

const app = new Hono().basePath('/api')

type EnvConfig = {
    UPSTASH_REDIS_REST_TOKEN: string
    UPSTASH_REDIS_REST_URL: string
}

app.use('/*', cors())
app.get('/search', async (c) => {

    try {
        const {UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL} = env<EnvConfig>(c)    

        const startTime = performance.now()
    
        const redis = new Redis({
            token: UPSTASH_REDIS_REST_TOKEN,
            url: UPSTASH_REDIS_REST_URL
        }) 
    
        let query = c.req.query("q")?.toUpperCase()
    
        if(!query) return c.json({message: "Invalid search query"}, {status: 400})
        
        const res: string[] = []
        const rank = await redis.zrank("terms", query)
    
        if(rank !== null && rank !== undefined) {
            const temp: string[] = await redis.zrange<string[]>("terms", rank, rank + 100)
    
            for(const element of temp) {
                if(!element.startsWith(query)) break
    
                if(element.endsWith('*')) res.push(element.substring(0, element.length - 1))
            }
        }

        const endTime = performance.now()
        return c.json({
            results: res,
            duration: endTime - startTime
        })
    } catch (err) {
        console.error(err)

        return c.json({results: [], message: "Something went wrong."}, 
            {
                status: 500,
            }
        )
    }

})

export const GET = handle(app)
export default app as never
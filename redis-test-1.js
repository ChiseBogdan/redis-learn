const Redis = require('ioredis');

const redis = new Redis({
    port: 6379,
    host: 'localhost',
})

const ONE_WEEK_IN_SECONDS = 7 * 86400
const VOTE_SCORE = 432
const ARTICLES_PER_PAGE = 25

const article_vote = async (redis, user, article) =>{

    const cutoff = new Date().getTime()/1000 - ONE_WEEK_IN_SECONDS
    const article_score = await redis.zscore('time:', article)
    if(article_score < cutoff) return

    const article_id = article.split(':')[1]
    const alreadyExists = await redis.sadd('voted:' + article_id, user)
    if(alreadyExists === 1){
        await redis.zincrby('score:', VOTE_SCORE, article)
        await redis.hincrby(article, 'votes', 1)
    }

}

const post_article = async (redis, user, title, link) =>{
    const article_id = await redis.incr('article:')
    const voted = 'voted:' + article_id

    redis.sadd(voted, user);
    redis.expire(voted, ONE_WEEK_IN_SECONDS);

    now = new Date().getTime();
    const article = 'article:' + article_id
    redis.hmset(article, {
        'title': title, 
        'link': link,
        'poster': user,
        'time': now, 
        'votes': 1
    })

    const score = now + VOTE_SCORE;
    redis.zadd('score:', score, article);
    redis.zadd('time:', now, article)

    return article_id;

}

const asyncForEach = async (array, callback) =>{
    for(let index = 0; index < array.length; index++){
        await callback(array[index], index, array)
    }
}

const get_articles = async (redis, page, order='score:') => {
    const start = (page-1) * ARTICLES_PER_PAGE
    const end = start + ARTICLES_PER_PAGE - 1
    let ids = await redis.zrevrange(order, start, end)
    let articles = []
    await asyncForEach(ids, async id =>{
        let article_data = await redis.hgetall(id)
        article_data['id'] = id
        articles.push(article_data)
    })
    return articles
    
}

const print_articles = articles =>{
    articles.forEach(article => console.log(article))
}

const start = async redis => {
    
    // const new_article_id = await post_article(redis, 'user:5', 'title:1', 'http://test-5.com')
    const articles = await get_articles(redis, 1)
    print_articles(articles)

    await article_vote(redis, 'user:202', 'article:4');
    const new_articles = await get_articles(redis, 1)
    print_articles(articles)
  }

start(redis)


---
title: "Developing a guitar practice app"
description: "Describing the problems I faced when developing a little web app."
publishDate: 2021-06-15
tags: ["ts", "react"]
---

The idea for the app came from my personal experience playing the guitar and the will to have an application where I can store my different routines for practicing. I have been following Justin Guitar for over half a year now and his site does have a practice assistant, however I have not found it to be very easy to use, despite the courses themselves being very good.

There are many types of routine you can have for guitar practice, such as: technique practice, knowledge, musical repertoire, timing, ear training, improvisation...

I wanted to create an application where the user can store all those different types of routines in one place where routines can be created, edited and deleted, effectively making this a CRUD app.

## Technologies used

-   React
-   Next.js
-   Supabase
-   React Hook Form
-   SWR
-   Tailwind CSS

Thinking of the tech stack, I wanted to use create-next-app for the smooth developer experience with routing, as well as the option to mix and match client side + server side rendering (SSR)

For my backend, I had an initial idea of using Google Firebase as I had used it before on a small practice project or two, but I recalled that it was rather cumbersome to use and setup. I then came across an open-source version of Firebase called [Supabase](https://supabase.com/), which allows you to use a similar assortment of cloud-hosted services (Database, File Storage, Auth) but using Postgres instead of Firebase's NoSQL database. After reading the documentation and looking at what Supabase has to offer, I decided on it for my backend.

The database was set up so that only logged in users could see and manage routines, and each routine was private to the user who created it.

# Challenges

## Client Side Rendering VS SSR

Deciding on the data fetching method was something that I struggled with on this project. Supabase tended to recommend using client side rendering, but when I used a standard method of fetching with the useEffect hook, it led to janky loading and not a smooth user experience.

```js
  useEffect(() => {
    getData();
  }, []);

  const getData = async () => {
    try {
      setIsLoading(true);
      let { data: routines, error } = await supabase
        .from('routines')
        .select('*');

      if (error) throw error;
      setData(routines);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) {
    return <div>Loading</div>;
  }

  if (!data) {
    return <div>No data...</div>;
  }

  return (
    ...
  )
```

Later, I decided to try and use Server Side Rendering for the data fetching. This however, proved to be more difficult to setup and with client side, as the browser had knowledge of the logged in user, and could fetch the data for that specific user. I couldn't perform a mass fetch of all routines in the database and then filter by user, as only logged in users could actually fetch data, which is a rule that I set up in Supabase. Of course, I could have changed that rule and made it so the server can request all routines from Supabase and then filter it so only the logged in user's routines are shown, but this did not seem like a clean design pattern, and I did not want the routines to be made available for all to see like that.

This was my solution to making server-side requests work

```js
export async function getServerSideProps({ req }) {
    const { user } = await supabase.auth.api.getUserByCookie(req)

    if (!user) {
        return { props: {}, redirect: { destination: "/login" } }
    }

    supabase.auth.setAuth(req.cookies["sb:token"])

    const { data: routines, error } = await supabase
        .from("routines")
        .select("*")

    if (error) {
        return {
            notFound: true,
        }
    }

    return {
        props: {
            routines,
        },
    }
}
```

The `supabase.auth.api.getUserByCookie()` function is made possible by this Next.js API route:

```js
import { supabase } from "../../lib/initSupabase"

const handler = (req, res) => {
    supabase.auth.api.setAuthCookie(req, res)
}

export default handler
```

This API route got called in **\_app.js**

```js
function MyApp({ Component, pageProps }) {
    const router = useRouter()
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    useEffect(() => {
        //fires when user signs in / out
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                updateSupabaseCookie(event, session)
                if (event === "SIGNED_IN") {
                    setIsLoggedIn(true)
                    router.push("/")
                }
                if (event === "SIGNED_OUT") {
                    setIsLoggedIn(false)
                    router.push("/login")
                }
            }
        )
        checkUser()
        return () => {
            authListener?.unsubscribe()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const checkUser = async () => {
        const user = supabase.auth.user()
        if (user) {
            setIsLoggedIn(true)
        }
    }

    async function updateSupabaseCookie(event, session) {
        await fetch("/api/auth", {
            method: "POST",
            headers: new Headers({ "Content-Type": "application/json" }),
            credentials: "same-origin",
            body: JSON.stringify({ event, session }),
        })
    }

    // return (
    //   ...
    // )
}
```

So now I had a way to make a server-side request as a logged in user by making use of cookies.

At the same time I began to think that this was perhaps an overengineered solution, as I had no real reason to fetch this data on the server, except for making it visually smoother for the user to see the page load and data to display.

---

My final solution to this challenge was to revert back to client side rendering with the [SWR hook](https://swr.vercel.app/) which brilliantly fixes the problem of janky loading and constant refetching and re-requesting the data which happened with the initial useEffect() fetching method.

Now my data fetching is done with only a few lines inside the page:

```js
const { data: routines, error } = useSWR("/api/getRoutines", fetcher)
```

the **/api/getRoutines.js** route looks like this:

```js
import { supabase } from "../../lib/initSupabase"

const getRoutines = async (req, res) => {
    supabase.auth.setAuth(req.cookies["sb:token"])
    const { data, error } = await supabase.from("routines").select("*")
    if (error) return res.status(401).json({ error: error.message })
    return res.status(200).json(data)
}

export default getRoutines
```

We still need to get the user's token from the cookie in order to fetch the data, but I believe this is a cleaner solution.

## Protecting pages

If a user was not logged in, I did not want them to access any pages except for **/login**. This meant checking on each page if a user is logged in, and if not, then redirecting them to the login page.

My first solution was to use a Supabase helper function to get the currently logged in user and then having a useEffect hook to check for it on each appropriate page. This worked, however it meant that the page partially loaded and showed itself to the user, before useEffect had time to check for the user. This led me to believe that I should check for this on the server's side, as the request has to fully complete before the page is shown.

This was not too much code and is a good solution to unauthorized user redirection, as it happens without any of the protected page's content loading in.

```js
export async function getServerSideProps({ req }) {
    const { user } = await supabase.auth.api.getUserByCookie(req)
    if (!user) {
        return { props: {}, redirect: { destination: "/login" } }
    }
    return { props: {} }
}
```

An advantage of this is also that if I want to, I can return the user as props to the page component in the future. For now, I do not have any functionality with user itself.

One way I can improve on this is to make this function reusable as it appears on several different pages.

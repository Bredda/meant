import { createBrowserRouter, RouterProvider } from "react-router";
import { AppLayout } from "@/components/layout";
import { threadLoader, threadsLoader } from "../features/threads/thread-loader";

const createAppRouter = () =>
  createBrowserRouter([
    {
      element: <AppLayout />,
      loader: threadsLoader,
      children: [
        {
          path: "/",
          lazy: () => import("@/app/routes/home"),
        },

        {
          path: "/threads",
          lazy: () => import("@/app/routes/new-thread"),
        },

        {
          path: "/threads/:id",
          lazy: () => import("@/app/routes/thread"),
          loader: threadLoader,
        },
        {
          path: "/settings",
          lazy: () => import("@/app/routes/settings"),
        },
      ],
    },

    {
      path: "*",
      lazy: () => import("@/app/routes/not-found"),
    },
  ]);

export default function AppRouter() {
  return <RouterProvider router={createAppRouter()} />;
}

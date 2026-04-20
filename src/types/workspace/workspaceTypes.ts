  export type CreateFolderDTO = {
    title: string
    description: string
    parentId: string | null
  }
  export type CreateBotDTO = {
    title: string
    description: string
    parentId: string | null
  }

  export type WorkspaceItemType = {
    id: string
    type: "folder" | "bot"
    title: string
    description: string
    indexItem?: number
    parentId: string | null
  }
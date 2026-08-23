'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Dialog({
   ...props
}) {
   return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
   ...props
}) {
   return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
   ...props
}) {
   return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
   ...props
}) {
   return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
   className,
   ...props
}) {
   return (
      <DialogPrimitive.Overlay
         data-slot="dialog-overlay"
         className={cn(
            'fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
            className
         )}
         {...props} />
   )
}

function DialogContent({
   className,
   children,
   showCloseButton = true,
   ...props
}) {
   return (
      <DialogPortal>
         <DialogOverlay />
         <DialogPrimitive.Content
            data-slot="dialog-content"
            className={cn(
               'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg bg-popover p-6 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
               className
            )}
            {...props}>
            {children}
            {showCloseButton &&
               <DialogPrimitive.Close
                  data-slot="dialog-close"
                  className="absolute top-4 right-4 rounded-xs text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none">
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
               </DialogPrimitive.Close>}
         </DialogPrimitive.Content>
      </DialogPortal>
   )
}

function DialogHeader({
   className,
   ...props
}) {
   return (
      <div
         data-slot="dialog-header"
         className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
         {...props} />
   )
}

function DialogFooter({
   className,
   ...props
}) {
   return (
      <div
         data-slot="dialog-footer"
         className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
         {...props} />
   )
}

function DialogTitle({
   className,
   ...props
}) {
   return (
      <DialogPrimitive.Title
         data-slot="dialog-title"
         className={cn('font-heading text-lg font-medium', className)}
         {...props} />
   )
}

function DialogDescription({
   className,
   ...props
}) {
   return (
      <DialogPrimitive.Description
         data-slot="dialog-description"
         className={cn('text-sm text-muted-foreground', className)}
         {...props} />
   )
}

export {
   Dialog,
   DialogClose,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogOverlay,
   DialogPortal,
   DialogTitle,
   DialogTrigger,
}

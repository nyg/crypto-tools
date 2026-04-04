export default async function error(req, res) {
   res.status(401).json({ message: 'Authentication required!' })
}

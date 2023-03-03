export default function ResultsPage({
  params
}:{
  params:{
    job_id: string,
    username: string
  },
}) {
  const {job_id, username} = params;
  return (
    <>
      <h2 className='subtitle'>Results</h2>
      <p>Username: {username}</p>
      <p>Job ID: {job_id}</p>
    </>
  )
} 
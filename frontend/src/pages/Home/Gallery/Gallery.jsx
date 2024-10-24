import React from 'react'
import image1 from '../../../assets/gallary/image1.png';
import image2 from '../../../assets/gallary/image2.png';


const Gallery = () => {
  return (
    <div className='md:w-[80%] mx-auto my-28'>
      <div className='mb-16'>
        <h1 className='text-5xl font-bold text-center'>Our Gallery</h1>
      </div>
      <div>
        <div className='mb-4 md:mb-0'>
            <img src={image1} alt="" className='md:h-[720px] w-full mx-auto' />
        </div>
        <div>
            <div>
                <img src={image2}  className='md:h-[350px]' alt="" />
            </div>
        </div>
      </div>
    </div>
  )
}

export default Gallery

import Image from 'next/image';

const TemplateCard = ({ title, imageSrc, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200"
    >
      <div className="relative h-48">
        {imageSrc ? (
          <Image 
            src={imageSrc} 
            alt={title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center p-4">
              <div className="text-gray-500 text-4xl mb-2">📄</div>
              <div className="text-gray-700 font-medium">{title}</div>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
    </div>
  );
};

export default TemplateCard; 